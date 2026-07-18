import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ChaosService } from '../chaos/chaos.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { EventsService } from '../events/events.service';
import { BillingService } from '../billing/billing.service';
import { InvoicesService } from '../invoices/invoices.service';
import { PaymentsService } from '../payments/payments.service';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { RecoveredViaChannel, SubscriptionStatus } from '../shared/enums';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

export const DUNNING_DELAYS_MS = [
  24 * 60 * 60 * 1000,
  72 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
] as const;

@Injectable()
export class DunningService {
  private readonly logger = new Logger(DunningService.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    @InjectQueue(QUEUE_NAMES.DUNNING) private dunningQueue: Queue,
    private subscriptionsService: SubscriptionsService,
    @Inject(forwardRef(() => BillingService))
    private billingService: BillingService,
    private invoicesService: InvoicesService,
    private paymentsService: PaymentsService,
    private eventsService: EventsService,
    private chaosService: ChaosService,
  ) {}

  async scheduleRetry(
    subscriptionId: string,
    attemptNumber: number,
  ): Promise<void> {
    if (attemptNumber > DUNNING_DELAYS_MS.length) {
      await this.suspendSubscription(subscriptionId);
      return;
    }

    const defaultDelay = DUNNING_DELAYS_MS[attemptNumber - 1];
    const subscription = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
    });
    const delay = subscription
      ? await this.chaosService.resolveDunningDelay(
          subscription.merchantId,
          defaultDelay,
        )
      : defaultDelay;
    await this.dunningQueue.add(
      'dunning-retry',
      { subscriptionId, attemptNumber },
      { delay, removeOnComplete: true },
    );

    if (subscription) {
      await this.eventsService.emit(DOMAIN_EVENTS.RETRY_SCHEDULED, {
        merchantId: subscription.merchantId,
        aggregateType: 'subscription',
        aggregateId: subscriptionId,
        correlationId: subscription.correlationId ?? undefined,
        data: {
          subscriptionId,
          attemptNumber,
          delayMs: delay,
          delayHours: Math.round(delay / (60 * 60 * 1000)),
        },
      });
    }

    this.logger.log(
      `Scheduled dunning attempt ${attemptNumber} for subscription ${subscriptionId} in ${delay}ms`,
    );
  }

  async processRetry(
    subscriptionId: string,
    attemptNumber: number,
  ): Promise<void> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
    });
    if (!subscription) return;

    if (
      subscription.status !== SubscriptionStatus.PAST_DUE &&
      subscription.status !== SubscriptionStatus.GRACE_PERIOD
    ) {
      return;
    }

    subscription.dunningAttemptCount = attemptNumber;
    await this.subscriptionRepo.save(subscription);

    await this.billingService.billSubscription(
      subscription,
      RecoveredViaChannel.AUTOMATIC,
    );

    const refreshed = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
    });
    if (!refreshed) return;

    if (refreshed.status === SubscriptionStatus.ACTIVE) {
      this.logger.log(`Payment recovered for subscription ${subscriptionId}`);
      return;
    }

    if (attemptNumber < DUNNING_DELAYS_MS.length) {
      if (attemptNumber === 2) {
        await this.subscriptionsService.transitionStatus(
          refreshed,
          SubscriptionStatus.GRACE_PERIOD,
        );
      }
      await this.scheduleRetry(subscriptionId, attemptNumber + 1);
    } else {
      await this.suspendSubscription(subscriptionId);
    }
  }

  async suspendSubscription(subscriptionId: string): Promise<void> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
    });
    if (!subscription) return;

    await this.subscriptionsService.transitionStatus(
      subscription,
      SubscriptionStatus.SUSPENDED,
    );
    this.logger.warn(`Subscription ${subscriptionId} suspended after dunning`);
  }

  async onPaymentFailed(subscriptionId: string): Promise<void> {
    await this.scheduleRetry(subscriptionId, 1);
  }
}
