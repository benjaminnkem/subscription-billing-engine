import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingService } from '../billing/billing.service';
import { Customer } from '../customers/entities/customer.entity';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { EventsService } from '../events/events.service';
import { Payment } from '../payments/entities/payment.entity';
import { MonnifyWebhooksService } from '../payments/monnify-webhooks.service';
import type { MonnifyWebhookPayload } from '../payments/monnify-webhook.types';
import { Plan } from '../plans/entities/plan.entity';
import { SubscriptionStatus } from '../shared/enums';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { ChaosService } from './chaos.service';
import { ChaosScenario, RunScenarioResult } from './chaos.types';
import { RunScenarioDto } from './dto/chaos.dto';

const DEMO_CARD_TOKEN = 'chaos_demo_card_token';

@Injectable()
export class ChaosScenarioRunner {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly chaosService: ChaosService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async run(
    merchantId: string,
    scenarioId: string,
    dto: RunScenarioDto = {},
  ): Promise<RunScenarioResult> {
    this.chaosService.assertEnabled();

    switch (scenarioId) {
      case 'insufficient-funds':
        return this.runInsufficientFunds(merchantId, dto.subscriptionId);
      case 'expired-card':
        return this.runExpiredCard(merchantId, dto.subscriptionId);
      case 'webhook-failure':
        return this.runWebhookFailure(merchantId, dto.subscriptionId);
      case 'slow-gateway':
        return this.runSlowGateway(merchantId, dto.subscriptionId);
      case 'duplicate-webhook':
        return this.runDuplicateWebhook(merchantId, dto.paymentId);
      default:
        throw new NotFoundException(`Unknown chaos scenario: ${scenarioId}`);
    }
  }

  private getBillingService(): BillingService {
    const service = this.moduleRef.get(BillingService, { strict: false });
    if (!service) {
      throw new Error('BillingService is not available');
    }
    return service;
  }

  private getEventsService(): EventsService {
    const service = this.moduleRef.get(EventsService, { strict: false });
    if (!service) {
      throw new Error('EventsService is not available');
    }
    return service;
  }

  private getMonnifyWebhooksService(): MonnifyWebhooksService {
    const service = this.moduleRef.get(MonnifyWebhooksService, {
      strict: false,
    });
    if (!service) {
      throw new Error('MonnifyWebhooksService is not available');
    }
    return service;
  }

  private async runInsufficientFunds(
    merchantId: string,
    subscriptionId?: string,
  ): Promise<RunScenarioResult> {
    const subscription = await this.resolveBillableSubscription(
      merchantId,
      subscriptionId,
    );

    await this.chaosService.setRules(merchantId, {
      enabled: true,
      mode: 'one-shot',
      scenarioQueue: [
        ChaosScenario.INSUFFICIENT_FUNDS,
        ChaosScenario.PAYMENT_SUCCESS,
      ],
      accelerateDunning: true,
      activeScenarioId: 'insufficient-funds',
    });

    await this.emitScenarioStarted(
      merchantId,
      subscription,
      'insufficient-funds',
    );
    await this.getBillingService().billSubscription(subscription);

    return {
      scenarioId: 'insufficient-funds',
      subscriptionId: subscription.id,
      correlationId: subscription.correlationId,
      message:
        'Insufficient funds injected. Watch Mission Control for fail → retry → recovery.',
    };
  }

  private async runExpiredCard(
    merchantId: string,
    subscriptionId?: string,
  ): Promise<RunScenarioResult> {
    const subscription = await this.resolveBillableSubscription(
      merchantId,
      subscriptionId,
    );

    await this.chaosService.setRules(merchantId, {
      enabled: true,
      mode: 'persistent',
      scenario: ChaosScenario.CARD_EXPIRED,
      accelerateDunning: true,
      activeScenarioId: 'expired-card',
    });

    await this.emitScenarioStarted(merchantId, subscription, 'expired-card');
    await this.getBillingService().billSubscription(subscription);

    return {
      scenarioId: 'expired-card',
      subscriptionId: subscription.id,
      correlationId: subscription.correlationId,
      message:
        'Expired card scenario active. Retries will fail until subscription suspends.',
    };
  }

  private async runWebhookFailure(
    merchantId: string,
    subscriptionId?: string,
  ): Promise<RunScenarioResult> {
    const subscription = await this.resolveBillableSubscription(
      merchantId,
      subscriptionId,
    );

    await this.chaosService.setRules(merchantId, {
      enabled: true,
      mode: 'one-shot',
      scenario: ChaosScenario.PAYMENT_SUCCESS,
      failWebhooks: true,
      activeScenarioId: 'webhook-failure',
    });

    await this.emitScenarioStarted(merchantId, subscription, 'webhook-failure');
    await this.getBillingService().billSubscription(subscription);

    return {
      scenarioId: 'webhook-failure',
      subscriptionId: subscription.id,
      correlationId: subscription.correlationId,
      message: 'Payment will succeed but outbound webhooks will fail delivery.',
    };
  }

  private async runSlowGateway(
    merchantId: string,
    subscriptionId?: string,
  ): Promise<RunScenarioResult> {
    const subscription = await this.resolveBillableSubscription(
      merchantId,
      subscriptionId,
    );

    await this.chaosService.setRules(merchantId, {
      enabled: true,
      mode: 'one-shot',
      scenario: ChaosScenario.SLOW_GATEWAY,
      slowGatewayMs: 5_000,
      activeScenarioId: 'slow-gateway',
    });

    await this.emitScenarioStarted(merchantId, subscription, 'slow-gateway');
    await this.getBillingService().billSubscription(subscription);

    return {
      scenarioId: 'slow-gateway',
      subscriptionId: subscription.id,
      correlationId: subscription.correlationId,
      message: 'Next charge will wait 5 seconds before completing.',
    };
  }

  private async runDuplicateWebhook(
    merchantId: string,
    paymentId?: string,
  ): Promise<RunScenarioResult> {
    const payment = paymentId
      ? await this.paymentRepo.findOne({ where: { id: paymentId, merchantId } })
      : await this.paymentRepo.findOne({
          where: { merchantId },
          order: { createdAt: 'DESC' },
        });

    if (!payment) {
      throw new BadRequestException(
        'No payment found. Create a subscription checkout first.',
      );
    }

    const paymentReference =
      payment.monnifyPaymentReference ?? payment.id;
    const transactionReference =
      payment.monnifyTransactionReference ?? `MNFY_CHAOS_DUP_${Date.now()}`;

    const payload: MonnifyWebhookPayload = {
      eventType: 'SUCCESSFUL_TRANSACTION',
      eventData: {
        product: { reference: paymentReference, type: 'WEB_SDK' },
        transactionReference,
        paymentReference,
        paymentStatus: 'PAID',
        paymentMethod: 'CARD',
        currency: payment.currency,
        amountPaid: payment.amount,
        paymentDescription: 'Chaos duplicate webhook test',
        cardDetails: {
          cardToken: DEMO_CARD_TOKEN,
          cardType: 'visa',
          last4: '4081',
          expMonth: '12',
          expYear: '2030',
        },
      },
    };

    await this.chaosService.setRules(merchantId, {
      enabled: true,
      mode: 'one-shot',
      activeScenarioId: 'duplicate-webhook',
    });

    const monnifyWebhooksService = this.getMonnifyWebhooksService();
    // Skip signature verification in chaos by omitting signature header
    await monnifyWebhooksService.process(payload, {});
    await monnifyWebhooksService.process(payload, {});

    const subscription = payment.subscriptionId
      ? await this.subscriptionRepo.findOne({
          where: { id: payment.subscriptionId, merchantId },
        })
      : null;

    return {
      scenarioId: 'duplicate-webhook',
      paymentId: payment.id,
      subscriptionId: subscription?.id,
      correlationId: subscription?.correlationId ?? null,
      message:
        'Duplicate SUCCESSFUL_TRANSACTION webhook replayed. Second delivery should be ignored.',
    };
  }

  private async resolveBillableSubscription(
    merchantId: string,
    subscriptionId?: string,
  ): Promise<Subscription> {
    let subscription: Subscription | null = null;

    if (subscriptionId) {
      subscription = await this.subscriptionRepo.findOne({
        where: { id: subscriptionId, merchantId },
        relations: { customer: true, plan: true },
      });
    } else {
      subscription = await this.subscriptionRepo.findOne({
        where: {
          merchantId,
          status: SubscriptionStatus.ACTIVE,
        },
        relations: { customer: true, plan: true },
        order: { createdAt: 'DESC' },
      });

      if (!subscription) {
        subscription = await this.subscriptionRepo.findOne({
          where: { merchantId, status: SubscriptionStatus.PAST_DUE },
          relations: { customer: true, plan: true },
          order: { createdAt: 'DESC' },
        });
      }
    }

    if (!subscription) {
      throw new BadRequestException(
        'No billable subscription found. Create an active subscription first.',
      );
    }

    await this.ensureDemoCardToken(subscription);

    const refreshed = await this.subscriptionRepo.findOne({
      where: { id: subscription.id, merchantId },
      relations: { customer: true, plan: true },
    });

    if (!refreshed) {
      throw new NotFoundException('Subscription not found');
    }

    return refreshed;
  }

  private async ensureDemoCardToken(subscription: Subscription): Promise<void> {
    const customer = await this.customerRepo.findOne({
      where: {
        id: subscription.customerId,
        merchantId: subscription.merchantId,
      },
    });

    if (!customer) return;

    if (!customer.monnifyCardToken) {
      customer.monnifyCardToken = DEMO_CARD_TOKEN;
      await this.customerRepo.save(customer);
    }
  }

  private async emitScenarioStarted(
    merchantId: string,
    subscription: Subscription,
    scenarioId: string,
  ): Promise<void> {
    await this.getEventsService().emit(DOMAIN_EVENTS.CHAOS_SCENARIO_STARTED, {
      merchantId,
      aggregateType: 'chaos',
      aggregateId: subscription.id,
      correlationId: subscription.correlationId ?? undefined,
      data: {
        scenarioId,
        subscriptionId: subscription.id,
      },
      metadata: {
        chaos: true,
        chaosScenario: scenarioId,
      },
    });
  }
}
