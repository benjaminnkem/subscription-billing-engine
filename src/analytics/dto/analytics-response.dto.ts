import { ApiProperty } from '@nestjs/swagger';

export class AnalyticsMetricsResponseDto {
  @ApiProperty({ description: 'Monthly Recurring Revenue', example: 150000.5 })
  mrr: number;

  @ApiProperty({ description: 'Annual Recurring Revenue', example: 1800006.0 })
  arr: number;

  @ApiProperty({
    description: 'Churn rate percentage (last 30 days)',
    example: 2.5,
  })
  churnRate: number;

  @ApiProperty({
    description: 'Payment recovery rate — failed payments later succeeded',
    example: 65.0,
  })
  recoveryRate: number;

  @ApiProperty({ description: 'Active subscriptions', example: 120 })
  activeSubscriptions: number;

  @ApiProperty({ description: 'Failed payments (all time)', example: 5 })
  failedPayments: number;

  @ApiProperty({ description: 'Trialing subscriptions', example: 15 })
  trialingSubscriptions: number;

  @ApiProperty({ description: 'Past due subscriptions', example: 3 })
  pastDueSubscriptions: number;

  @ApiProperty({ description: 'Grace period subscriptions', example: 2 })
  gracePeriodSubscriptions: number;

  @ApiProperty({ description: 'Suspended subscriptions', example: 1 })
  suspendedSubscriptions: number;

  @ApiProperty({ description: 'Cancelled subscriptions', example: 8 })
  cancelledSubscriptions: number;

  @ApiProperty({ description: 'Pending subscriptions', example: 4 })
  pendingSubscriptions: number;

  @ApiProperty({ description: 'Expired subscriptions', example: 2 })
  expiredSubscriptions: number;

  @ApiProperty({
    description: 'Total subscriptions across all statuses',
    example: 155,
  })
  totalSubscriptions: number;

  @ApiProperty({ description: 'Total customers', example: 200 })
  totalCustomers: number;

  @ApiProperty({
    description: 'New customers in the last 30 days',
    example: 12,
  })
  newCustomersLast30Days: number;

  @ApiProperty({
    description: 'Total collected revenue from succeeded payments',
    example: 2500000,
  })
  totalRevenue: number;

  @ApiProperty({
    description: 'Revenue collected in the last 30 days',
    example: 450000,
  })
  revenueLast30Days: number;

  @ApiProperty({ description: 'Succeeded payments count', example: 340 })
  successfulPayments: number;

  @ApiProperty({
    description: 'Payment success rate percentage',
    example: 92.5,
  })
  paymentSuccessRate: number;

  @ApiProperty({
    description: 'Average revenue per active subscriber',
    example: 1250,
  })
  arpu: number;

  @ApiProperty({
    description: 'Trial to active conversion rate (last 30 days)',
    example: 45.0,
  })
  trialConversionRate: number;

  @ApiProperty({ description: 'Unpaid pending invoices', example: 6 })
  outstandingInvoices: number;

  @ApiProperty({
    description: 'Total amount of outstanding invoices',
    example: 75000,
  })
  outstandingInvoiceAmount: number;

  @ApiProperty({
    description: 'Subscriptions currently in dunning',
    example: 4,
  })
  dunningSubscriptions: number;

  @ApiProperty({
    description: 'Average dunning attempts for at-risk subs',
    example: 1.5,
  })
  averageDunningAttempts: number;
}

export class RevenueTrendPointDto {
  @ApiProperty({ example: '2026-01-15' })
  date: string;

  @ApiProperty({ example: 125000 })
  revenue: number;

  @ApiProperty({ example: 18 })
  paymentCount: number;
}

export class SubscriptionTrendPointDto {
  @ApiProperty({ example: '2026-01-15' })
  date: string;

  @ApiProperty({ example: 5 })
  newSubscriptions: number;

  @ApiProperty({ example: 1 })
  cancelledSubscriptions: number;

  @ApiProperty({ example: 4 })
  netChange: number;
}

export class PlanAnalyticsDto {
  @ApiProperty()
  planId: string;

  @ApiProperty()
  planName: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  interval: string;

  @ApiProperty()
  activeSubscriptions: number;

  @ApiProperty()
  trialingSubscriptions: number;

  @ApiProperty()
  mrr: number;

  @ApiProperty({ description: 'Share of total MRR percentage' })
  mrrSharePercent: number;
}

export class PaymentAnalyticsDto {
  @ApiProperty()
  totalPayments: number;

  @ApiProperty()
  succeededPayments: number;

  @ApiProperty()
  failedPayments: number;

  @ApiProperty()
  pendingPayments: number;

  @ApiProperty()
  refundedPayments: number;

  @ApiProperty()
  successRate: number;

  @ApiProperty()
  recoveryRate: number;

  @ApiProperty()
  totalRevenue: number;

  @ApiProperty()
  revenueLast30Days: number;

  @ApiProperty()
  averagePaymentAmount: number;

  @ApiProperty()
  totalAttempts: number;

  @ApiProperty()
  failedAttempts: number;
}

export class TopCustomerDto {
  @ApiProperty()
  customerId: string;

  @ApiProperty()
  customerName: string;

  @ApiProperty()
  customerEmail: string;

  @ApiProperty()
  totalRevenue: number;

  @ApiProperty()
  paymentCount: number;

  @ApiProperty()
  activeSubscriptions: number;
}

export class CustomerAnalyticsDto {
  @ApiProperty()
  totalCustomers: number;

  @ApiProperty()
  newCustomersLast30Days: number;

  @ApiProperty()
  customersWithActiveSubscriptions: number;

  @ApiProperty()
  averageRevenuePerCustomer: number;

  @ApiProperty({ type: [TopCustomerDto] })
  topCustomers: TopCustomerDto[];
}

export class DunningAnalyticsDto {
  @ApiProperty()
  pastDueSubscriptions: number;

  @ApiProperty()
  gracePeriodSubscriptions: number;

  @ApiProperty()
  subscriptionsInDunning: number;

  @ApiProperty()
  averageDunningAttempts: number;

  @ApiProperty()
  maxDunningAttempts: number;

  @ApiProperty()
  recoveredAfterDunning: number;

  @ApiProperty()
  cancelledAfterDunning: number;
}

export class WebhookAnalyticsDto {
  @ApiProperty()
  totalDeliveries: number;

  @ApiProperty()
  deliveredCount: number;

  @ApiProperty()
  failedCount: number;

  @ApiProperty()
  pendingCount: number;

  @ApiProperty()
  successRate: number;
}

export class ActivityItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  eventType: string;

  @ApiProperty({ required: false })
  aggregateType?: string;

  @ApiProperty({ required: false })
  aggregateId?: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  payload: Record<string, unknown>;

  @ApiProperty()
  createdAt: string;
}

export class ActivityListResponseDto {
  @ApiProperty({ type: [ActivityItemDto] })
  data: ActivityItemDto[];

  @ApiProperty()
  total: number;
}

export class AnalyticsOverviewResponseDto {
  @ApiProperty({ type: AnalyticsMetricsResponseDto })
  metrics: AnalyticsMetricsResponseDto;

  @ApiProperty({ type: PaymentAnalyticsDto })
  payments: PaymentAnalyticsDto;

  @ApiProperty({ type: CustomerAnalyticsDto })
  customers: CustomerAnalyticsDto;

  @ApiProperty({ type: DunningAnalyticsDto })
  dunning: DunningAnalyticsDto;

  @ApiProperty({ type: WebhookAnalyticsDto })
  webhooks: WebhookAnalyticsDto;

  @ApiProperty({ type: [PlanAnalyticsDto] })
  planBreakdown: PlanAnalyticsDto[];
}
