import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { EventStore } from '../events/entities/event-store.entity';
import { EmailRecipientResolver } from '../mail/email-recipient.resolver';
import { EmailTemplateRegistry } from '../mail/email-template.registry';
import { MailService } from '../mail/mail.service';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { NotificationChannel, NotificationStatus } from '../shared/enums';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private notificationsQueue: Queue,
    private recipientResolver: EmailRecipientResolver,
    private templateRegistry: EmailTemplateRegistry,
    private mailService: MailService,
  ) {}

  async queueForEvent(event: EventStore): Promise<void> {
    const templateDefinition = this.templateRegistry.resolve(event);
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

    const notification = this.notificationRepo.create({
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
    this.logger.log(`[SMS] To: ${notification.recipient}`);
  }
}
