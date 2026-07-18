import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { EventStore } from '../events/entities/event-store.entity';
import { EmailRecipientResolver } from '../mail/email-recipient.resolver';
import { EmailTemplateRegistry } from '../mail/email-template.registry';
import { MailService } from '../mail/mail.service';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { NotificationChannel, NotificationStatus } from '../shared/enums';
import { Notification } from './entities/notification.entity';
import {
  RecoveryMessage,
  RecoveryMessageBuilder,
} from './recovery-message.builder';

interface TwilioMessageResponse {
  sid: string;
  status: string;
  to: string;
  from: string;
  body?: string;
  [key: string]: unknown;
}

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private notificationsQueue: Queue,
    private recipientResolver: EmailRecipientResolver,
    private templateRegistry: EmailTemplateRegistry,
    private recoveryMessageBuilder: RecoveryMessageBuilder,
    private mailService: MailService,
    private config: ConfigService,
  ) {}

  async queueForEvent(event: EventStore): Promise<void> {
    await this.queueEmailForEvent(event);

    try {
      await this.queuePhoneChannelsForEvent(event);
    } catch (error) {
      this.logger.error(
        `Phone-channel notification queuing failed for event ${event.id} (${event.eventType}) — email delivery and event processing are unaffected`,
        error,
      );
    }
  }

  private async queueEmailForEvent(event: EventStore): Promise<void> {
    const templateDefinition = await this.templateRegistry.resolve(event);
    if (!templateDefinition) {
      return;
    }

    const recipient = this.recipientResolver.resolve(event);
    if (!recipient) {
      this.logger.warn(
        `No email recipient for event ${event.eventType} (${event.id})`,
      );
      return;
    }

    await this.queueNotification({
      merchantId: event.merchantId,
      channel: NotificationChannel.EMAIL,
      recipient,
      subject: templateDefinition.subject,
      body: templateDefinition.template,
      eventType: event.eventType,
      metadata: {
        eventId: event.id,
        template: templateDefinition.template,
        context: templateDefinition.context,
      },
    });
  }

  private async queuePhoneChannelsForEvent(event: EventStore): Promise<void> {
    const message = this.recoveryMessageBuilder.resolve(event);
    if (!message) return;

    const phone = await this.resolvePhone(event);
    if (!phone) return;

    await this.queueChannelNotification(
      event,
      NotificationChannel.WHATSAPP,
      phone,
      message,
    );
    await this.queueChannelNotification(
      event,
      NotificationChannel.SMS,
      phone,
      message,
    );
  }

  private async resolvePhone(event: EventStore): Promise<string | null> {
    const payload = event.payload ?? {};
    const invoice = payload.invoice as { customerId?: string } | undefined;
    const customerId = invoice?.customerId;
    if (!customerId) return null;

    const customer = await this.customerRepo.findOne({
      where: { id: customerId, merchantId: event.merchantId },
    });

    return customer?.phone ?? null;
  }

  private async queueChannelNotification(
    event: EventStore,
    channel: NotificationChannel,
    recipient: string,
    message: RecoveryMessage,
  ): Promise<void> {
    await this.queueNotification({
      merchantId: event.merchantId,
      channel,
      recipient,
      subject: message.subject,
      body: message.body,
      eventType: event.eventType,
      metadata: { eventId: event.id },
    });
  }

  private async queueNotification(input: {
    merchantId: string;
    channel: NotificationChannel;
    recipient: string;
    subject: string;
    body: string;
    eventType: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    const notification = this.notificationRepo.create(input);
    const saved = await this.notificationRepo.save(notification);

    await this.notificationsQueue.add(
      'send-notification',
      { notificationId: saved.id },
      { removeOnComplete: true },
    );
  }

  async send(notificationId: string): Promise<void> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });
    if (!notification) return;

    try {
      if (notification.channel === NotificationChannel.EMAIL) {
        await this.sendEmail(notification);
      } else if (notification.channel === NotificationChannel.SMS) {
        await this.sendSms(notification);
      } else if (notification.channel === NotificationChannel.WHATSAPP) {
        await this.sendWhatsapp(notification);
      }
      notification.status = NotificationStatus.SENT;
      notification.sentAt = new Date();
    } catch (error) {
      this.logger.error('Notification delivery failed', error);
      notification.status = NotificationStatus.FAILED;
    }

    await this.notificationRepo.save(notification);
  }

  private async sendEmail(notification: Notification): Promise<void> {
    const metadata = notification.metadata ?? {};
    const template =
      typeof metadata.template === 'string'
        ? metadata.template
        : notification.body;
    const context =
      metadata.context && typeof metadata.context === 'object'
        ? (metadata.context as Record<string, unknown>)
        : {};

    await this.mailService.sendTemplate(
      notification.recipient,
      template,
      context,
      notification.subject,
    );
  }

  private async sendSms(notification: Notification): Promise<void> {
    const from = this.config.get<string>('twilio.smsFrom');

    if (!this.isTwilioConfigured() || !from) {
      this.recordProviderResult(
        notification,
        this.simulateTwilioSend({
          channel: 'sms',
          to: notification.recipient,
          from: from || '+15005550006',
          body: notification.body,
        }),
      );
      return;
    }

    const response = await this.callTwilio({
      to: notification.recipient,
      from,
      body: notification.body,
    });
    this.recordProviderResult(notification, response);
  }

  private async sendWhatsapp(notification: Notification): Promise<void> {
    const from = this.config.get<string>('twilio.whatsappFrom');

    if (!this.isTwilioConfigured() || !from) {
      this.recordProviderResult(
        notification,
        this.simulateTwilioSend({
          channel: 'whatsapp',
          to: `whatsapp:${notification.recipient}`,
          from: from || 'whatsapp:+14155238886',
          body: notification.body,
        }),
      );
      return;
    }

    const response = await this.callTwilio({
      to: `whatsapp:${notification.recipient}`,
      from,
      body: notification.body,
    });
    this.recordProviderResult(notification, response);
  }

  private isTwilioConfigured(): boolean {
    return Boolean(
      this.config.get<string>('twilio.accountSid') &&
      this.config.get<string>('twilio.authToken'),
    );
  }

  private async callTwilio(params: {
    to: string;
    from: string;
    body: string;
  }): Promise<TwilioMessageResponse> {
    const accountSid = this.config.get<string>('twilio.accountSid');
    const authToken = this.config.get<string>('twilio.authToken');
    const url = `${TWILIO_API_BASE}/Accounts/${accountSid}/Messages.json`;

    const form = new URLSearchParams({
      To: params.to,
      From: params.from,
      Body: params.body,
    });

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString(
      'base64',
    );

    this.logger.log({
      msg: 'Twilio message request',
      to: params.to,
      from: params.from,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    const data = (await response.json()) as TwilioMessageResponse & {
      message?: string;
    };

    if (!response.ok) {
      throw new Error(data.message ?? 'Twilio message send failed');
    }

    this.logger.log({
      msg: 'Twilio message response',
      sid: data.sid,
      status: data.status,
    });

    return data;
  }

  private simulateTwilioSend(params: {
    channel: 'sms' | 'whatsapp';
    to: string;
    from: string;
    body: string;
  }): TwilioMessageResponse {
    this.logger.log(
      `[${params.channel.toUpperCase()}][SIMULATED] To: ${params.to} | Body: ${params.body}`,
    );

    return {
      sid: `SM_sim_${Date.now()}`,
      status: 'queued',
      to: params.to,
      from: params.from,
      body: params.body,
      simulated: true,
    };
  }

  private recordProviderResult(
    notification: Notification,
    response: TwilioMessageResponse,
  ): void {
    notification.metadata = {
      ...(notification.metadata ?? {}),
      providerMessageId: response.sid,
      providerStatus: response.status,
      simulated: Boolean(response.simulated),
    };
  }
}
