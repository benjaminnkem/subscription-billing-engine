import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { EventStore } from '../events/entities/event-store.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { PaymentAttempt } from '../payments/entities/payment-attempt.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Plan } from '../plans/entities/plan.entity';
import {
  InvoiceStatus,
  PaymentStatus,
  SubscriptionStatus,
  WebhookDeliveryStatus,
} from '../shared/enums';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { WebhookDelivery } from '../webhooks/entities/webhook-delivery.entity';
import {
  ActivityItem,
  ActivityListResponse,
  AnalyticsMetrics,
  AnalyticsOverview,
  CustomerAnalytics,
  DunningAnalytics,
  PaymentAnalytics,
  PlanAnalytics,
  RecoveryByChannel,
  RevenueTrendPoint,
  SubscriptionTrendPoint,
  TopCustomer,
  TrendGranularity,
  WebhookAnalytics,
} from './analytics.types';
import {
  daysAgo,
  generateDateBuckets,
  normalizeToMonthly,
  parseAmount,
  postgresDateTrunc,
  resolveDateRange,
  round,
  safePercent,
  truncateDate,
} from './analytics.util';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    @InjectRepository(PaymentAttempt)
    private paymentAttemptRepo: Repository<PaymentAttempt>,
    @InjectRepository(Plan)
    private planRepo: Repository<Plan>,
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
    @InjectRepository(EventStore)
    private eventStoreRepo: Repository<EventStore>,
    @InjectRepository(WebhookDelivery)
    private webhookDeliveryRepo: Repository<WebhookDelivery>,
  ) {}

  async getMetrics(merchantId: string): Promise<AnalyticsMetrics> {
    const thirtyDaysAgo = daysAgo(30);

    const [
      subscriptionCounts,
      activeSubsWithPlans,
      cancelledLast30Days,
      totalActiveStart,
      paymentCounts,
      revenueTotals,
      customerCounts,
      invoiceOutstanding,
      dunningStats,
      trialConversion,
      recoveryRate,
    ] = await Promise.all([
      this.getSubscriptionStatusCounts(merchantId),
      this.subscriptionRepo.find({
        where: { merchantId, status: SubscriptionStatus.ACTIVE },
        relations: { plan: true },
      }),
      this.countCancelledSince(merchantId, thirtyDaysAgo),
      this.countActiveAtDate(merchantId, thirtyDaysAgo),
      this.getPaymentStatusCounts(merchantId),
      this.getRevenueTotals(merchantId, thirtyDaysAgo),
      this.getCustomerCounts(merchantId, thirtyDaysAgo),
      this.getOutstandingInvoices(merchantId),
      this.getDunningStats(merchantId),
      this.getTrialConversionRate(merchantId, thirtyDaysAgo),
      this.countRecoveredPayments(merchantId),
    ]);

    const mrr = this.sumMrr(activeSubsWithPlans);
    const arr = mrr * 12;
    const churnRate = safePercent(cancelledLast30Days, totalActiveStart);
    const paymentSuccessRate = safePercent(
      paymentCounts.succeeded,
      paymentCounts.succeeded + paymentCounts.failed,
    );
    const arpu =
      activeSubsWithPlans.length > 0
        ? round(mrr / activeSubsWithPlans.length)
        : 0;

    return {
      mrr: round(mrr),
      arr: round(arr),
      churnRate,
      recoveryRate,
      activeSubscriptions: subscriptionCounts.active,
      failedPayments: paymentCounts.failed,
      trialingSubscriptions: subscriptionCounts.trialing,
      pastDueSubscriptions: subscriptionCounts.pastDue,
      gracePeriodSubscriptions: subscriptionCounts.gracePeriod,
      suspendedSubscriptions: subscriptionCounts.suspended,
      cancelledSubscriptions: subscriptionCounts.cancelled,
      pendingSubscriptions: subscriptionCounts.pending,
      expiredSubscriptions: subscriptionCounts.expired,
      totalSubscriptions: subscriptionCounts.total,
      totalCustomers: customerCounts.total,
      newCustomersLast30Days: customerCounts.newLast30Days,
      totalRevenue: revenueTotals.total,
      revenueLast30Days: revenueTotals.last30Days,
      successfulPayments: paymentCounts.succeeded,
      paymentSuccessRate,
      arpu,
      trialConversionRate: trialConversion,
      outstandingInvoices: invoiceOutstanding.count,
      outstandingInvoiceAmount: invoiceOutstanding.amount,
      dunningSubscriptions: dunningStats.inDunning,
      averageDunningAttempts: dunningStats.averageAttempts,
    };
  }

  async getOverview(merchantId: string): Promise<AnalyticsOverview> {
    const [metrics, payments, customers, dunning, webhooks, planBreakdown] =
      await Promise.all([
        this.getMetrics(merchantId),
        this.getPaymentAnalytics(merchantId),
        this.getCustomerAnalytics(merchantId),
        this.getDunningAnalytics(merchantId),
        this.getWebhookAnalytics(merchantId),
        this.getPlanBreakdown(merchantId),
      ]);

    return { metrics, payments, customers, dunning, webhooks, planBreakdown };
  }

  async getRevenueTrend(
    merchantId: string,
    from?: string,
    to?: string,
    granularity: TrendGranularity = 'day',
  ): Promise<RevenueTrendPoint[]> {
    const range = resolveDateRange(from, to);
    const trunc = postgresDateTrunc(granularity);

    const rows = await this.paymentRepo
      .createQueryBuilder('p')
      .select(`DATE_TRUNC('${trunc}', p."paidAt")`, 'bucket')
      .addSelect('COALESCE(SUM(p.amount::numeric), 0)', 'revenue')
      .addSelect('COUNT(p.id)', 'paymentCount')
      .where('p.merchantId = :merchantId', { merchantId })
      .andWhere('p.status = :status', { status: PaymentStatus.SUCCEEDED })
      .andWhere('p."paidAt" IS NOT NULL')
      .andWhere('p."paidAt" >= :from', { from: range.from })
      .andWhere('p."paidAt" <= :to', { to: range.to })
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany<{ bucket: Date; revenue: string; paymentCount: string }>();

    const bucketMap = new Map<string, RevenueTrendPoint>();
    for (const row of rows) {
      const date = truncateDate(new Date(row.bucket), granularity);
      bucketMap.set(date, {
        date,
        revenue: round(parseAmount(row.revenue)),
        paymentCount: parseInt(row.paymentCount, 10) || 0,
      });
    }

    return generateDateBuckets(range.from, range.to, granularity).map(
      (date) => bucketMap.get(date) ?? { date, revenue: 0, paymentCount: 0 },
    );
  }

  async getSubscriptionTrend(
    merchantId: string,
    from?: string,
    to?: string,
    granularity: TrendGranularity = 'day',
  ): Promise<SubscriptionTrendPoint[]> {
    const range = resolveDateRange(from, to);
    const trunc = postgresDateTrunc(granularity);

    const [newRows, cancelledRows] = await Promise.all([
      this.subscriptionRepo
        .createQueryBuilder('s')
        .select(`DATE_TRUNC('${trunc}', s."createdAt")`, 'bucket')
        .addSelect('COUNT(s.id)', 'count')
        .where('s.merchantId = :merchantId', { merchantId })
        .andWhere('s."createdAt" >= :from', { from: range.from })
        .andWhere('s."createdAt" <= :to', { to: range.to })
        .groupBy('bucket')
        .orderBy('bucket', 'ASC')
        .getRawMany<{ bucket: Date; count: string }>(),
      this.subscriptionRepo
        .createQueryBuilder('s')
        .select(`DATE_TRUNC('${trunc}', s."cancelledAt")`, 'bucket')
        .addSelect('COUNT(s.id)', 'count')
        .where('s.merchantId = :merchantId', { merchantId })
        .andWhere('s."cancelledAt" IS NOT NULL')
        .andWhere('s."cancelledAt" >= :from', { from: range.from })
        .andWhere('s."cancelledAt" <= :to', { to: range.to })
        .groupBy('bucket')
        .orderBy('bucket', 'ASC')
        .getRawMany<{ bucket: Date; count: string }>(),
    ]);

    const newMap = new Map<string, number>();
    for (const row of newRows) {
      newMap.set(
        truncateDate(new Date(row.bucket), granularity),
        parseInt(row.count, 10) || 0,
      );
    }

    const cancelledMap = new Map<string, number>();
    for (const row of cancelledRows) {
      cancelledMap.set(
        truncateDate(new Date(row.bucket), granularity),
        parseInt(row.count, 10) || 0,
      );
    }

    return generateDateBuckets(range.from, range.to, granularity).map(
      (date) => {
        const newSubscriptions = newMap.get(date) ?? 0;
        const cancelledSubscriptions = cancelledMap.get(date) ?? 0;
        return {
          date,
          newSubscriptions,
          cancelledSubscriptions,
          netChange: newSubscriptions - cancelledSubscriptions,
        };
      },
    );
  }

  async getPlanBreakdown(merchantId: string): Promise<PlanAnalytics[]> {
    const plans = await this.planRepo.find({
      where: { merchantId },
      order: { createdAt: 'ASC' },
    });

    if (plans.length === 0) return [];

    const statusRows = await this.subscriptionRepo
      .createQueryBuilder('s')
      .select('s.planId', 'planId')
      .addSelect('s.status', 'status')
      .addSelect('COUNT(s.id)', 'count')
      .where('s.merchantId = :merchantId', { merchantId })
      .andWhere('s.status IN (:...statuses)', {
        statuses: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
      })
      .groupBy('s.planId')
      .addGroupBy('s.status')
      .getRawMany<{
        planId: string;
        status: SubscriptionStatus;
        count: string;
      }>();

    const countByPlan = new Map<string, { active: number; trialing: number }>();
    for (const row of statusRows) {
      const entry = countByPlan.get(row.planId) ?? { active: 0, trialing: 0 };
      const count = parseInt(row.count, 10) || 0;
      if (row.status === SubscriptionStatus.ACTIVE) entry.active = count;
      if (row.status === SubscriptionStatus.TRIALING) entry.trialing = count;
      countByPlan.set(row.planId, entry);
    }

    const breakdown: PlanAnalytics[] = plans.map((plan) => {
      const counts = countByPlan.get(plan.id) ?? { active: 0, trialing: 0 };
      const amount = parseAmount(plan.amount);
      const monthlyAmount = normalizeToMonthly(
        amount,
        plan.interval,
        plan.customIntervalDays,
      );
      return {
        planId: plan.id,
        planName: plan.name,
        amount,
        currency: plan.currency,
        interval: plan.interval,
        activeSubscriptions: counts.active,
        trialingSubscriptions: counts.trialing,
        mrr: round(monthlyAmount * counts.active),
        mrrSharePercent: 0,
      };
    });

    const totalMrr = breakdown.reduce((sum, plan) => sum + plan.mrr, 0);
    for (const plan of breakdown) {
      plan.mrrSharePercent = safePercent(plan.mrr, totalMrr);
    }

    return breakdown.sort((a, b) => b.mrr - a.mrr);
  }

  async getPaymentAnalytics(merchantId: string): Promise<PaymentAnalytics> {
    const thirtyDaysAgo = daysAgo(30);
    const [paymentCounts, revenueTotals, attemptCounts, recoveryRate] =
      await Promise.all([
        this.getPaymentStatusCounts(merchantId),
        this.getRevenueTotals(merchantId, thirtyDaysAgo),
        this.getPaymentAttemptCounts(merchantId),
        this.countRecoveredPayments(merchantId),
      ]);

    const settled = paymentCounts.succeeded + paymentCounts.failed;
    const averagePaymentAmount =
      paymentCounts.succeeded > 0
        ? round(revenueTotals.total / paymentCounts.succeeded)
        : 0;

    return {
      totalPayments: paymentCounts.total,
      succeededPayments: paymentCounts.succeeded,
      failedPayments: paymentCounts.failed,
      pendingPayments: paymentCounts.pending,
      refundedPayments: paymentCounts.refunded,
      successRate: safePercent(paymentCounts.succeeded, settled),
      recoveryRate,
      totalRevenue: revenueTotals.total,
      revenueLast30Days: revenueTotals.last30Days,
      averagePaymentAmount,
      totalAttempts: attemptCounts.total,
      failedAttempts: attemptCounts.failed,
    };
  }

  async getCustomerAnalytics(merchantId: string): Promise<CustomerAnalytics> {
    const thirtyDaysAgo = daysAgo(30);
    const [customerCounts, customersWithActive, topCustomers, revenueTotals] =
      await Promise.all([
        this.getCustomerCounts(merchantId, thirtyDaysAgo),
        this.countCustomersWithActiveSubscriptions(merchantId),
        this.getTopCustomers(merchantId, 10),
        this.getRevenueTotals(merchantId, thirtyDaysAgo),
      ]);

    const averageRevenuePerCustomer =
      customerCounts.total > 0
        ? round(revenueTotals.total / customerCounts.total)
        : 0;

    return {
      totalCustomers: customerCounts.total,
      newCustomersLast30Days: customerCounts.newLast30Days,
      customersWithActiveSubscriptions: customersWithActive,
      averageRevenuePerCustomer,
      topCustomers,
    };
  }

  async getDunningAnalytics(merchantId: string): Promise<DunningAnalytics> {
    const [
      statusCounts,
      dunningStats,
      recoveredAfterDunning,
      cancelledAfterDunning,
      recoveryByChannel,
    ] = await Promise.all([
      this.getSubscriptionStatusCounts(merchantId),
      this.getDunningStats(merchantId),
      this.subscriptionRepo
        .createQueryBuilder('s')
        .where('s.merchantId = :merchantId', { merchantId })
        .andWhere('s.dunningAttemptCount > 0')
        .andWhere('s.status = :status', { status: SubscriptionStatus.ACTIVE })
        .getCount(),
      this.subscriptionRepo
        .createQueryBuilder('s')
        .where('s.merchantId = :merchantId', { merchantId })
        .andWhere('s.dunningAttemptCount > 0')
        .andWhere('s.status = :status', {
          status: SubscriptionStatus.CANCELLED,
        })
        .getCount(),
      this.getRecoveryByChannel(merchantId),
    ]);

    return {
      pastDueSubscriptions: statusCounts.pastDue,
      gracePeriodSubscriptions: statusCounts.gracePeriod,
      subscriptionsInDunning: dunningStats.inDunning,
      averageDunningAttempts: dunningStats.averageAttempts,
      maxDunningAttempts: dunningStats.maxAttempts,
      recoveredAfterDunning,
      cancelledAfterDunning,
      recoveryByChannel,
    };
  }

  async getWebhookAnalytics(merchantId: string): Promise<WebhookAnalytics> {
    const rows = await this.webhookDeliveryRepo
      .createQueryBuilder('d')
      .innerJoin('d.webhook', 'w')
      .select('d.status', 'status')
      .addSelect('COUNT(d.id)', 'count')
      .where('w.merchantId = :merchantId', { merchantId })
      .groupBy('d.status')
      .getRawMany<{ status: WebhookDeliveryStatus; count: string }>();

    let totalDeliveries = 0;
    let deliveredCount = 0;
    let failedCount = 0;
    let pendingCount = 0;

    for (const row of rows) {
      const count = parseInt(row.count, 10) || 0;
      totalDeliveries += count;
      if (row.status === WebhookDeliveryStatus.DELIVERED)
        deliveredCount = count;
      if (row.status === WebhookDeliveryStatus.FAILED) failedCount += count;
      if (row.status === WebhookDeliveryStatus.DEAD_LETTER)
        failedCount += count;
      if (row.status === WebhookDeliveryStatus.PENDING) pendingCount = count;
    }

    return {
      totalDeliveries,
      deliveredCount,
      failedCount,
      pendingCount,
      successRate: safePercent(deliveredCount, totalDeliveries),
    };
  }

  async getActivity(
    merchantId: string,
    page = 1,
    limit = 20,
  ): Promise<ActivityListResponse> {
    const [events, total] = await this.eventStoreRepo.findAndCount({
      where: { merchantId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        createdAt: event.createdAt.toISOString(),
      })),
      total,
    };
  }

  async recordEvent(_event: EventStore): Promise<void> {
    // Events are persisted in event_store; metrics are computed on demand.
  }

  private sumMrr(subscriptions: Subscription[]): number {
    let mrr = 0;
    for (const sub of subscriptions) {
      const plan = sub.plan;
      if (!plan) continue;
      mrr += normalizeToMonthly(
        parseAmount(plan.amount),
        plan.interval,
        plan.customIntervalDays,
      );
    }
    return mrr;
  }

  private async getSubscriptionStatusCounts(merchantId: string) {
    const rows = await this.subscriptionRepo
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(s.id)', 'count')
      .where('s.merchantId = :merchantId', { merchantId })
      .groupBy('s.status')
      .getRawMany<{ status: SubscriptionStatus; count: string }>();

    const counts = {
      active: 0,
      trialing: 0,
      pastDue: 0,
      gracePeriod: 0,
      suspended: 0,
      cancelled: 0,
      pending: 0,
      expired: 0,
      total: 0,
    };

    for (const row of rows) {
      const count = parseInt(row.count, 10) || 0;
      counts.total += count;
      switch (row.status) {
        case SubscriptionStatus.ACTIVE:
          counts.active = count;
          break;
        case SubscriptionStatus.TRIALING:
          counts.trialing = count;
          break;
        case SubscriptionStatus.PAST_DUE:
          counts.pastDue = count;
          break;
        case SubscriptionStatus.GRACE_PERIOD:
          counts.gracePeriod = count;
          break;
        case SubscriptionStatus.SUSPENDED:
          counts.suspended = count;
          break;
        case SubscriptionStatus.CANCELLED:
          counts.cancelled = count;
          break;
        case SubscriptionStatus.PENDING:
          counts.pending = count;
          break;
        case SubscriptionStatus.EXPIRED:
          counts.expired = count;
          break;
      }
    }

    return counts;
  }

  private async getPaymentStatusCounts(merchantId: string) {
    const rows = await this.paymentRepo
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(p.id)', 'count')
      .where('p.merchantId = :merchantId', { merchantId })
      .groupBy('p.status')
      .getRawMany<{ status: PaymentStatus; count: string }>();

    const counts = {
      total: 0,
      succeeded: 0,
      failed: 0,
      pending: 0,
      refunded: 0,
    };

    for (const row of rows) {
      const count = parseInt(row.count, 10) || 0;
      counts.total += count;
      switch (row.status) {
        case PaymentStatus.SUCCEEDED:
          counts.succeeded = count;
          break;
        case PaymentStatus.FAILED:
          counts.failed = count;
          break;
        case PaymentStatus.PENDING:
          counts.pending = count;
          break;
        case PaymentStatus.REFUNDED:
          counts.refunded = count;
          break;
      }
    }

    return counts;
  }

  private async getRevenueTotals(merchantId: string, since: Date) {
    const [totalRow, last30Row] = await Promise.all([
      this.paymentRepo
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.amount::numeric), 0)', 'total')
        .where('p.merchantId = :merchantId', { merchantId })
        .andWhere('p.status = :status', { status: PaymentStatus.SUCCEEDED })
        .getRawOne<{ total: string }>(),
      this.paymentRepo
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.amount::numeric), 0)', 'total')
        .where('p.merchantId = :merchantId', { merchantId })
        .andWhere('p.status = :status', { status: PaymentStatus.SUCCEEDED })
        .andWhere('p."paidAt" >= :since', { since })
        .getRawOne<{ total: string }>(),
    ]);

    return {
      total: round(parseAmount(totalRow?.total)),
      last30Days: round(parseAmount(last30Row?.total)),
    };
  }

  private async getCustomerCounts(merchantId: string, since: Date) {
    const [total, newLast30Days] = await Promise.all([
      this.customerRepo.count({ where: { merchantId } }),
      this.customerRepo
        .createQueryBuilder('c')
        .where('c.merchantId = :merchantId', { merchantId })
        .andWhere('c."createdAt" >= :since', { since })
        .getCount(),
    ]);

    return { total, newLast30Days };
  }

  private async getOutstandingInvoices(merchantId: string) {
    const row = await this.invoiceRepo
      .createQueryBuilder('i')
      .select('COUNT(i.id)', 'count')
      .addSelect('COALESCE(SUM(i.total::numeric), 0)', 'amount')
      .where('i.merchantId = :merchantId', { merchantId })
      .andWhere('i.status = :status', { status: InvoiceStatus.PENDING })
      .getRawOne<{ count: string; amount: string }>();

    return {
      count: parseInt(row?.count ?? '0', 10) || 0,
      amount: round(parseAmount(row?.amount)),
    };
  }

  private async getDunningStats(merchantId: string) {
    const row = await this.subscriptionRepo
      .createQueryBuilder('s')
      .select('COUNT(s.id)', 'inDunning')
      .addSelect('COALESCE(AVG(s.dunningAttemptCount), 0)', 'averageAttempts')
      .addSelect('COALESCE(MAX(s.dunningAttemptCount), 0)', 'maxAttempts')
      .where('s.merchantId = :merchantId', { merchantId })
      .andWhere('s.dunningAttemptCount > 0')
      .andWhere('s.status IN (:...statuses)', {
        statuses: [
          SubscriptionStatus.PAST_DUE,
          SubscriptionStatus.GRACE_PERIOD,
          SubscriptionStatus.SUSPENDED,
        ],
      })
      .getRawOne<{
        inDunning: string;
        averageAttempts: string;
        maxAttempts: string;
      }>();

    return {
      inDunning: parseInt(row?.inDunning ?? '0', 10) || 0,
      averageAttempts: round(parseAmount(row?.averageAttempts)),
      maxAttempts: parseInt(row?.maxAttempts ?? '0', 10) || 0,
    };
  }

  private async getRecoveryByChannel(
    merchantId: string,
  ): Promise<RecoveryByChannel> {
    const rows = await this.eventStoreRepo
      .createQueryBuilder('e')
      .select("COALESCE(e.payload->>'recoveredVia', 'automatic')", 'channel')
      .addSelect('COUNT(*)', 'count')
      .where('e.merchantId = :merchantId', { merchantId })
      .andWhere('e.eventType = :eventType', {
        eventType: DOMAIN_EVENTS.PAYMENT_RECOVERED,
      })
      .groupBy("COALESCE(e.payload->>'recoveredVia', 'automatic')")
      .getRawMany<{ channel: string; count: string }>();

    const result: RecoveryByChannel = {
      automatic: 0,
      whatsapp: 0,
      sms: 0,
      email: 0,
      ussd: 0,
    };

    for (const row of rows) {
      if (row.channel in result) {
        result[row.channel as keyof RecoveryByChannel] =
          parseInt(row.count, 10) || 0;
      }
    }

    return result;
  }

  private async getTrialConversionRate(merchantId: string, since: Date) {
    const [converted, startedTrials] = await Promise.all([
      this.subscriptionRepo
        .createQueryBuilder('s')
        .where('s.merchantId = :merchantId', { merchantId })
        .andWhere('s.status = :status', { status: SubscriptionStatus.ACTIVE })
        .andWhere('s."trialEndsAt" IS NOT NULL')
        .andWhere('s."trialEndsAt" >= :since', { since })
        .andWhere('s."trialEndsAt" <= NOW()')
        .getCount(),
      this.subscriptionRepo
        .createQueryBuilder('s')
        .where('s.merchantId = :merchantId', { merchantId })
        .andWhere('s."trialEndsAt" IS NOT NULL')
        .andWhere('s."trialEndsAt" >= :since', { since })
        .andWhere('s."trialEndsAt" <= NOW()')
        .getCount(),
    ]);

    return safePercent(converted, startedTrials);
  }

  private async countRecoveredPayments(merchantId: string): Promise<number> {
    const row = await this.paymentAttemptRepo
      .createQueryBuilder('a')
      .innerJoin('a.payment', 'p')
      .select('COUNT(DISTINCT p.id)', 'count')
      .where('p.merchantId = :merchantId', { merchantId })
      .andWhere('p.status = :status', { status: PaymentStatus.SUCCEEDED })
      .andWhere((qb) => {
        const sub = qb
          .subQuery()
          .select('1')
          .from(PaymentAttempt, 'fa')
          .where('fa.paymentId = p.id')
          .andWhere('fa.status = :failedStatus')
          .getQuery();
        return `EXISTS ${sub}`;
      })
      .setParameter('failedStatus', PaymentStatus.FAILED)
      .getRawOne<{ count: string }>();

    const recovered = parseInt(row?.count ?? '0', 10) || 0;

    const failedWithAttempts = await this.paymentRepo
      .createQueryBuilder('p')
      .where('p.merchantId = :merchantId', { merchantId })
      .andWhere((qb) => {
        const sub = qb
          .subQuery()
          .select('1')
          .from(PaymentAttempt, 'fa')
          .where('fa.paymentId = p.id')
          .andWhere('fa.status = :failedStatus')
          .getQuery();
        return `EXISTS ${sub}`;
      })
      .setParameter('failedStatus', PaymentStatus.FAILED)
      .getCount();

    return safePercent(recovered, failedWithAttempts);
  }

  private async getPaymentAttemptCounts(merchantId: string) {
    const rows = await this.paymentAttemptRepo
      .createQueryBuilder('a')
      .innerJoin('a.payment', 'p')
      .select('a.status', 'status')
      .addSelect('COUNT(a.id)', 'count')
      .where('p.merchantId = :merchantId', { merchantId })
      .groupBy('a.status')
      .getRawMany<{ status: PaymentStatus; count: string }>();

    let total = 0;
    let failed = 0;
    for (const row of rows) {
      const count = parseInt(row.count, 10) || 0;
      total += count;
      if (row.status === PaymentStatus.FAILED) failed = count;
    }

    return { total, failed };
  }

  private async countCustomersWithActiveSubscriptions(
    merchantId: string,
  ): Promise<number> {
    const row = await this.subscriptionRepo
      .createQueryBuilder('s')
      .select('COUNT(DISTINCT s.customerId)', 'count')
      .where('s.merchantId = :merchantId', { merchantId })
      .andWhere('s.status IN (:...statuses)', {
        statuses: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
      })
      .getRawOne<{ count: string }>();

    return parseInt(row?.count ?? '0', 10) || 0;
  }

  private async getTopCustomers(
    merchantId: string,
    limit: number,
  ): Promise<TopCustomer[]> {
    const revenueRows = await this.paymentRepo
      .createQueryBuilder('p')
      .innerJoin('p.invoice', 'i')
      .innerJoin('i.customer', 'c')
      .select('c.id', 'customerId')
      .addSelect('c.name', 'customerName')
      .addSelect('c.email', 'customerEmail')
      .addSelect('COALESCE(SUM(p.amount::numeric), 0)', 'totalRevenue')
      .addSelect('COUNT(p.id)', 'paymentCount')
      .where('p.merchantId = :merchantId', { merchantId })
      .andWhere('p.status = :status', { status: PaymentStatus.SUCCEEDED })
      .groupBy('c.id')
      .addGroupBy('c.name')
      .addGroupBy('c.email')
      .orderBy('totalRevenue', 'DESC')
      .limit(limit)
      .getRawMany<{
        customerId: string;
        customerName: string;
        customerEmail: string;
        totalRevenue: string;
        paymentCount: string;
      }>();

    if (revenueRows.length === 0) return [];

    const customerIds = revenueRows.map((row) => row.customerId);
    const activeSubRows = await this.subscriptionRepo
      .createQueryBuilder('s')
      .select('s.customerId', 'customerId')
      .addSelect('COUNT(s.id)', 'count')
      .where('s.merchantId = :merchantId', { merchantId })
      .andWhere('s.customerId IN (:...customerIds)', { customerIds })
      .andWhere('s.status = :status', { status: SubscriptionStatus.ACTIVE })
      .groupBy('s.customerId')
      .getRawMany<{ customerId: string; count: string }>();

    const activeSubMap = new Map(
      activeSubRows.map((row) => [
        row.customerId,
        parseInt(row.count, 10) || 0,
      ]),
    );

    return revenueRows.map((row) => ({
      customerId: row.customerId,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      totalRevenue: round(parseAmount(row.totalRevenue)),
      paymentCount: parseInt(row.paymentCount, 10) || 0,
      activeSubscriptions: activeSubMap.get(row.customerId) ?? 0,
    }));
  }

  private async countCancelledSince(
    merchantId: string,
    since: Date,
  ): Promise<number> {
    return this.subscriptionRepo
      .createQueryBuilder('s')
      .where('s.merchantId = :merchantId', { merchantId })
      .andWhere('s.status = :status', { status: SubscriptionStatus.CANCELLED })
      .andWhere('s."cancelledAt" >= :since', { since })
      .getCount();
  }

  private async countActiveAtDate(
    merchantId: string,
    date: Date,
  ): Promise<number> {
    return this.subscriptionRepo
      .createQueryBuilder('s')
      .where('s.merchantId = :merchantId', { merchantId })
      .andWhere('s."createdAt" <= :date', { date })
      .andWhere('s.status IN (:...statuses)', {
        statuses: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
      })
      .getCount();
  }
}
