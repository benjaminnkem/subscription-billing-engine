import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BillingService } from '../billing/billing.service';
import { Customer } from '../customers/entities/customer.entity';
import { RecoveredViaChannel, SubscriptionStatus } from '../shared/enums';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { RecoveryAction } from './recovery-action.enum';

export interface RecoveryActionResult {
  subscriptionId: string;
  merchantId: string;
  previousStatus: SubscriptionStatus;
  newStatus: SubscriptionStatus;
  replyMessage: string;
}

const RECOVERY_CHANNEL_ACTOR = 'recovery-channel';

@Injectable()
export class RecoveryChannelsService {
  private readonly logger = new Logger(RecoveryChannelsService.name);

  constructor(
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    private subscriptionsService: SubscriptionsService,
    private billingService: BillingService,
  ) {}

  async handleAction(
    phone: string,
    action: RecoveryAction,
    channel: RecoveredViaChannel.WHATSAPP | RecoveredViaChannel.USSD,
  ): Promise<RecoveryActionResult> {
    const subscription = await this.findSubscriptionByPhone(phone);
    return this.executeAction(subscription, action, channel);
  }

  async executeAction(
    subscription: Subscription,
    action: RecoveryAction,
    channel:
      | RecoveredViaChannel.WHATSAPP
      | RecoveredViaChannel.USSD
      | RecoveredViaChannel.EMAIL,
  ): Promise<RecoveryActionResult> {
    try {
      switch (action) {
        case RecoveryAction.STATUS:
          return this.buildStatusResult(subscription);
        case RecoveryAction.RETRY:
          return await this.retry(subscription, channel);
        case RecoveryAction.PAUSE:
          return await this.pause(subscription);
        case RecoveryAction.CANCEL:
          return await this.cancel(subscription);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Recovery action ${action} failed for subscription ${subscription.id}: ${message}`,
      );
      return {
        subscriptionId: subscription.id,
        merchantId: subscription.merchantId,
        previousStatus: subscription.status,
        newStatus: subscription.status,
        replyMessage: `We couldn't do that right now (${message}). Your subscription is still ${subscription.status}.`,
      };
    }
  }

  private async findSubscriptionByPhone(phone: string): Promise<Subscription> {
    const normalizedPhone = phone.replace(/^whatsapp:/, '').trim();

    const customers = await this.customerRepo.find({
      where: { phone: normalizedPhone },
    });

    if (customers.length === 0) {
      throw new NotFoundException(
        `No customer found for phone ${normalizedPhone}`,
      );
    }

    if (customers.length > 1) {
      this.logger.warn(
        `Phone ${normalizedPhone} matches ${customers.length} customers across merchants — using the most recently updated subscription. See findSubscriptionByPhone doc comment.`,
      );
    }

    const subscription = await this.subscriptionRepo.findOne({
      where: { customerId: In(customers.map((c) => c.id)) },
      relations: { customer: true, plan: true },
      order: { updatedAt: 'DESC' },
    });

    if (!subscription) {
      throw new NotFoundException(
        `No subscription found for phone ${normalizedPhone}`,
      );
    }

    return subscription;
  }

  private async retry(
    subscription: Subscription,
    channel:
      | RecoveredViaChannel.WHATSAPP
      | RecoveredViaChannel.USSD
      | RecoveredViaChannel.EMAIL,
  ): Promise<RecoveryActionResult> {
    const previousStatus = subscription.status;

    if (
      previousStatus !== SubscriptionStatus.PAST_DUE &&
      previousStatus !== SubscriptionStatus.GRACE_PERIOD
    ) {
      return {
        subscriptionId: subscription.id,
        merchantId: subscription.merchantId,
        previousStatus,
        newStatus: previousStatus,
        replyMessage: `Your subscription is already ${previousStatus}. Nothing to retry.`,
      };
    }

    await this.billingService.billSubscription(subscription, channel);

    const refreshed = await this.subscriptionRepo.findOneOrFail({
      where: { id: subscription.id },
    });

    const replyMessage =
      refreshed.status === SubscriptionStatus.ACTIVE
        ? 'Payment succeeded. Your subscription is active again.'
        : "That didn't go through. We'll keep retrying automatically, or update your card in the portal.";

    return {
      subscriptionId: refreshed.id,
      merchantId: refreshed.merchantId,
      previousStatus,
      newStatus: refreshed.status,
      replyMessage,
    };
  }

  private async pause(
    subscription: Subscription,
  ): Promise<RecoveryActionResult> {
    const previousStatus = subscription.status;
    const updated = await this.subscriptionsService.pause(
      subscription.merchantId,
      subscription.id,
      RECOVERY_CHANNEL_ACTOR,
    );

    return {
      subscriptionId: updated.id,
      merchantId: updated.merchantId,
      previousStatus,
      newStatus: updated.status,
      replyMessage:
        'Your subscription is paused. Reply RETRY any time to resume billing.',
    };
  }

  private async cancel(
    subscription: Subscription,
  ): Promise<RecoveryActionResult> {
    const previousStatus = subscription.status;
    const updated = await this.subscriptionsService.cancel(
      subscription.merchantId,
      subscription.id,
      RECOVERY_CHANNEL_ACTOR,
    );

    return {
      subscriptionId: updated.id,
      merchantId: updated.merchantId,
      previousStatus,
      newStatus: updated.status,
      replyMessage: 'Your subscription has been cancelled.',
    };
  }

  private buildStatusResult(subscription: Subscription): RecoveryActionResult {
    return {
      subscriptionId: subscription.id,
      merchantId: subscription.merchantId,
      previousStatus: subscription.status,
      newStatus: subscription.status,
      replyMessage: `Your subscription is ${subscription.status}. Next billing date: ${subscription.currentPeriodEnd.toDateString()}.`,
    };
  }
}
