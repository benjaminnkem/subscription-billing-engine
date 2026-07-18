import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProrationService } from '../billing/proration.service';
import { CustomersService } from '../customers/customers.service';
import { DunningService } from '../dunning/dunning.service';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { EventsService } from '../events/events.service';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoicesService } from '../invoices/invoices.service';
import { Plan } from '../plans/entities/plan.entity';
import { PaymentStatus, SubscriptionStatus } from '../shared/enums';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { MonnifyWebhookEvent } from './entities/monnify-webhook-event.entity';
import { PaymentAttempt } from './entities/payment-attempt.entity';
import { Payment } from './entities/payment.entity';
import { verifyMonnifySignature } from './monnify-signature.util';
import { MonnifyService } from './monnify.service';
import { parsePaymentIdFromReference } from './monnify.util';
import {
  MonnifyWebhookHeaders,
  MonnifyWebhookPayload,
} from './monnify-webhook.types';

@Injectable()
export class MonnifyWebhooksService {
  private readonly logger = new Logger(MonnifyWebhooksService.name);

  constructor(
    @InjectRepository(MonnifyWebhookEvent)
    private webhookEventRepo: Repository<MonnifyWebhookEvent>,
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    @InjectRepository(PaymentAttempt)
    private attemptRepo: Repository<PaymentAttempt>,
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Plan)
    private planRepo: Repository<Plan>,
    private config: ConfigService,
    private monnifyService: MonnifyService,
    private invoicesService: InvoicesService,
    private subscriptionsService: SubscriptionsService,
    private prorationService: ProrationService,
    private eventsService: EventsService,
    private dunningService: DunningService,
    private customersService: CustomersService,
  ) {}

  async process(
    payload: MonnifyWebhookPayload,
    headers: MonnifyWebhookHeaders,
  ): Promise<{ received: true }> {
    this.verifySignature(payload, headers);

    const eventKey = this.buildEventKey(payload);
    if (!eventKey) {
      this.logger.warn('Monnify webhook missing transaction/payment reference');
      return { received: true };
    }

    const existing = await this.webhookEventRepo.findOne({
      where: { eventKey },
    });
    if (existing) {
      this.logger.log(`Duplicate Monnify webhook ignored: ${eventKey}`);
      return { received: true };
    }

    switch (payload.eventType) {
      case 'SUCCESSFUL_TRANSACTION':
        await this.handleSuccessfulTransaction(payload, eventKey);
        break;
      case 'SUCCESSFUL_REFUND':
        await this.handleSuccessfulRefund(payload, eventKey);
        break;
      case 'REJECTED_PAYMENT':
        await this.handleRejectedPayment(payload, eventKey);
        break;
      default:
        this.logger.log(`Unhandled Monnify event type: ${payload.eventType}`);
        await this.recordEvent(eventKey, payload.eventType, payload, undefined);
    }

    return { received: true };
  }

  private verifySignature(
    payload: MonnifyWebhookPayload,
    headers: MonnifyWebhookHeaders,
  ): void {
    const secret =
      this.config.get<string>('monnify.webhookSecret') ||
      this.config.get<string>('monnify.secretKey');
    const nodeEnv = this.config.get<string>('nodeEnv');

    if (!secret) {
      if (nodeEnv === 'production') {
        throw new UnauthorizedException(
          'Monnify webhook secret is not configured',
        );
      }
      this.logger.warn(
        'MONNIFY_WEBHOOK_SECRET / MONNIFY_SECRET_KEY not set — skipping signature verification',
      );
      return;
    }

    const signature = headers.signature;
    const bodyForVerify = headers.rawBody ?? payload;

    if (
      !signature ||
      !verifyMonnifySignature(bodyForVerify, secret, signature)
    ) {
      throw new UnauthorizedException('Invalid Monnify webhook signature');
    }
  }

  private buildEventKey(payload: MonnifyWebhookPayload): string | undefined {
    const data = payload.eventData ?? {};
    const ref =
      data.transactionReference ??
      data.paymentReference ??
      data.product?.reference;
    if (!ref) return undefined;
    return `${payload.eventType}:${ref}`;
  }

  private async handleSuccessfulTransaction(
    payload: MonnifyWebhookPayload,
    eventKey: string,
  ): Promise<void> {
    const payment = await this.resolvePayment(payload);
    if (!payment) {
      this.logger.warn(
        `SUCCESSFUL_TRANSACTION webhook could not be matched to a payment (${eventKey})`,
      );
      await this.recordEvent(eventKey, payload.eventType, payload, undefined);
      return;
    }

    if (payment.status === PaymentStatus.SUCCEEDED) {
      await this.persistCardToken(payload, payment);
      await this.recordEvent(eventKey, payload.eventType, payload, payment);
      return;
    }

    const transactionReference = payload.eventData.transactionReference;
    const paymentReference = payload.eventData.paymentReference;
    const wasFailed = payment.status === PaymentStatus.FAILED;

    payment.status = PaymentStatus.SUCCEEDED;
    payment.monnifyTransactionReference =
      transactionReference ?? payment.monnifyTransactionReference;
    payment.monnifyPaymentReference =
      paymentReference ?? payment.monnifyPaymentReference;
    payment.failureReason = undefined;
    payment.paidAt = new Date();
    await this.paymentRepo.save(payment);

    const attemptCount = await this.attemptRepo.count({
      where: { paymentId: payment.id },
    });
    await this.attemptRepo.save(
      this.attemptRepo.create({
        merchantId: payment.merchantId,
        paymentId: payment.id,
        attemptNumber: attemptCount + 1,
        status: PaymentStatus.SUCCEEDED,
        monnifyTransactionReference: transactionReference,
        monnifyPaymentReference: paymentReference,
        responsePayload: payload as unknown as Record<string, unknown>,
      }),
    );

    const invoice = await this.invoiceRepo.findOne({
      where: { id: payment.invoiceId, merchantId: payment.merchantId },
    });
    if (!invoice) {
      await this.persistCardToken(payload, payment);
      await this.recordEvent(eventKey, payload.eventType, payload, payment);
      return;
    }

    await this.invoicesService.markPaid(invoice);

    let subscription: Subscription | null = null;
    if (payment.subscriptionId) {
      subscription = await this.subscriptionRepo.findOne({
        where: { id: payment.subscriptionId, merchantId: payment.merchantId },
      });

      if (subscription) {
        const plan = await this.planRepo.findOne({
          where: { id: subscription.planId, merchantId: payment.merchantId },
        });

        if (plan) {
          const intervalDays = this.prorationService.getIntervalDays(
            plan.interval,
            plan.customIntervalDays,
          );
          subscription.currentPeriodStart = new Date();
          subscription.currentPeriodEnd = new Date(
            Date.now() + intervalDays * 86400000,
          );
          subscription.dunningAttemptCount = 0;
        }

        if (subscription.status !== SubscriptionStatus.ACTIVE) {
          await this.subscriptionsService.transitionStatus(
            subscription,
            SubscriptionStatus.ACTIVE,
          );
        } else {
          await this.subscriptionRepo.save(subscription);
        }
      }
    }

    await this.eventsService.emit(DOMAIN_EVENTS.INVOICE_PAID, {
      merchantId: payment.merchantId,
      aggregateType: 'invoice',
      aggregateId: invoice.id,
      data: { invoice, payment, subscription },
    });

    if (subscription) {
      if (wasFailed) {
        await this.eventsService.emit(DOMAIN_EVENTS.PAYMENT_RECOVERED, {
          merchantId: payment.merchantId,
          aggregateType: 'payment',
          aggregateId: payment.id,
          data: { payment, invoice },
        });
      } else {
        await this.eventsService.emit(DOMAIN_EVENTS.SUBSCRIPTION_RENEWED, {
          merchantId: payment.merchantId,
          aggregateType: 'subscription',
          aggregateId: subscription.id,
          data: { subscription, invoice },
        });
      }
    }

    await this.persistCardToken(payload, payment);
    await this.recordEvent(eventKey, payload.eventType, payload, payment);
  }

  private async handleRejectedPayment(
    payload: MonnifyWebhookPayload,
    eventKey: string,
  ): Promise<void> {
    const payment = await this.resolvePayment(payload);
    if (!payment) {
      this.logger.warn(
        `REJECTED_PAYMENT webhook could not be matched to a payment (${eventKey})`,
      );
      await this.recordEvent(eventKey, payload.eventType, payload, undefined);
      return;
    }

    if (
      payment.status === PaymentStatus.FAILED ||
      payment.status === PaymentStatus.SUCCEEDED
    ) {
      await this.recordEvent(eventKey, payload.eventType, payload, payment);
      return;
    }

    const failureReason =
      (payload.eventData.paymentDescription as string | undefined) ??
      'Payment rejected';

    payment.status = PaymentStatus.FAILED;
    payment.failureReason = failureReason;
    payment.monnifyTransactionReference =
      payload.eventData.transactionReference ??
      payment.monnifyTransactionReference;
    payment.monnifyPaymentReference =
      payload.eventData.paymentReference ?? payment.monnifyPaymentReference;
    await this.paymentRepo.save(payment);

    const attemptCount = await this.attemptRepo.count({
      where: { paymentId: payment.id },
    });
    await this.attemptRepo.save(
      this.attemptRepo.create({
        merchantId: payment.merchantId,
        paymentId: payment.id,
        attemptNumber: attemptCount + 1,
        status: PaymentStatus.FAILED,
        monnifyTransactionReference: payload.eventData.transactionReference,
        monnifyPaymentReference: payload.eventData.paymentReference,
        failureReason,
        responsePayload: payload as unknown as Record<string, unknown>,
      }),
    );

    const invoice = await this.invoiceRepo.findOne({
      where: { id: payment.invoiceId, merchantId: payment.merchantId },
    });
    if (invoice) {
      await this.invoicesService.markFailed(invoice);
    }

    if (payment.subscriptionId) {
      const subscription = await this.subscriptionRepo.findOne({
        where: { id: payment.subscriptionId, merchantId: payment.merchantId },
      });
      if (subscription) {
        await this.subscriptionsService.transitionStatus(
          subscription,
          SubscriptionStatus.PAST_DUE,
        );
        await this.dunningService.onPaymentFailed(subscription.id);
      }
    }

    if (invoice) {
      await this.eventsService.emit(DOMAIN_EVENTS.PAYMENT_FAILED, {
        merchantId: payment.merchantId,
        aggregateType: 'payment',
        aggregateId: payment.id,
        data: { payment, invoice },
      });
    }

    await this.recordEvent(eventKey, payload.eventType, payload, payment);
  }

  private async handleSuccessfulRefund(
    payload: MonnifyWebhookPayload,
    eventKey: string,
  ): Promise<void> {
    const payment = await this.resolvePayment(payload);
    if (!payment) {
      this.logger.warn(
        `SUCCESSFUL_REFUND webhook could not be matched to a payment (${eventKey})`,
      );
      await this.recordEvent(eventKey, payload.eventType, payload, undefined);
      return;
    }

    payment.status = PaymentStatus.REFUNDED;
    payment.monnifyTransactionReference =
      payload.eventData.transactionReference ??
      payment.monnifyTransactionReference;
    payment.monnifyPaymentReference =
      payload.eventData.paymentReference ?? payment.monnifyPaymentReference;
    await this.paymentRepo.save(payment);

    await this.recordEvent(eventKey, payload.eventType, payload, payment);
  }

  private async resolvePayment(
    payload: MonnifyWebhookPayload,
  ): Promise<Payment | null> {
    const data = payload.eventData ?? {};
    const references = [
      data.paymentReference,
      data.transactionReference,
      data.product?.reference,
    ].filter((value): value is string => Boolean(value));

    for (const reference of references) {
      const byPaymentRef = await this.paymentRepo.findOne({
        where: { monnifyPaymentReference: reference },
      });
      if (byPaymentRef) return byPaymentRef;

      const byTxnRef = await this.paymentRepo.findOne({
        where: { monnifyTransactionReference: reference },
      });
      if (byTxnRef) return byTxnRef;

      const paymentId = parsePaymentIdFromReference(reference);
      if (paymentId) {
        const payment = await this.paymentRepo.findOne({
          where: { id: paymentId },
        });
        if (payment) return payment;
      }

      // Checkout uses payment.id as paymentReference
      const byId = await this.paymentRepo.findOne({
        where: { id: reference },
      });
      if (byId) return byId;
    }

    return null;
  }

  private async persistCardToken(
    payload: MonnifyWebhookPayload,
    payment: Payment,
  ): Promise<void> {
    let cardToken = payload.eventData.cardDetails?.cardToken;

    if (!cardToken) {
      const status = await this.monnifyService.getTransactionStatus({
        paymentReference:
          payload.eventData.paymentReference ?? payment.monnifyPaymentReference,
        transactionReference:
          payload.eventData.transactionReference ??
          payment.monnifyTransactionReference,
      });
      cardToken = status.cardToken;
    }

    if (!cardToken) {
      return;
    }

    const invoice = await this.invoiceRepo.findOne({
      where: { id: payment.invoiceId, merchantId: payment.merchantId },
    });
    if (!invoice) {
      return;
    }

    await this.customersService.saveMonnifyCardToken(
      payment.merchantId,
      invoice.customerId,
      cardToken,
    );
  }

  private async recordEvent(
    eventKey: string,
    eventType: string,
    payload: MonnifyWebhookPayload,
    payment: Payment | undefined,
  ): Promise<void> {
    await this.webhookEventRepo.save(
      this.webhookEventRepo.create({
        eventKey,
        eventType,
        merchantId: payment?.merchantId,
        paymentId: payment?.id,
        payload: payload as unknown as Record<string, unknown>,
      }),
    );
  }
}
