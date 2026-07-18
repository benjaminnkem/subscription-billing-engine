export type TrendGranularity = 'day' | 'week' | 'month';

export interface AnalyticsMetrics {
  mrr: number;
  arr: number;
  churnRate: number;
  recoveryRate: number;
  activeSubscriptions: number;
  failedPayments: number;
  trialingSubscriptions: number;
  pastDueSubscriptions: number;
  gracePeriodSubscriptions: number;
  suspendedSubscriptions: number;
  cancelledSubscriptions: number;
  pendingSubscriptions: number;
  expiredSubscriptions: number;
  totalSubscriptions: number;
  totalCustomers: number;
  newCustomersLast30Days: number;
  totalRevenue: number;
  revenueLast30Days: number;
  successfulPayments: number;
  paymentSuccessRate: number;
  arpu: number;
  trialConversionRate: number;
  outstandingInvoices: number;
  outstandingInvoiceAmount: number;
  dunningSubscriptions: number;
  averageDunningAttempts: number;
}

export interface TrendDataPoint {
  date: string;
  value: number;
}

export interface RevenueTrendPoint {
  date: string;
  revenue: number;
  paymentCount: number;
}

export interface SubscriptionTrendPoint {
  date: string;
  newSubscriptions: number;
  cancelledSubscriptions: number;
  netChange: number;
}

export interface PlanAnalytics {
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  interval: string;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  mrr: number;
  mrrSharePercent: number;
}

export interface PaymentAnalytics {
  totalPayments: number;
  succeededPayments: number;
  failedPayments: number;
  pendingPayments: number;
  refundedPayments: number;
  successRate: number;
  recoveryRate: number;
  totalRevenue: number;
  revenueLast30Days: number;
  averagePaymentAmount: number;
  totalAttempts: number;
  failedAttempts: number;
}

export interface TopCustomer {
  customerId: string;
  customerName: string;
  customerEmail: string;
  totalRevenue: number;
  paymentCount: number;
  activeSubscriptions: number;
}

export interface CustomerAnalytics {
  totalCustomers: number;
  newCustomersLast30Days: number;
  customersWithActiveSubscriptions: number;
  averageRevenuePerCustomer: number;
  topCustomers: TopCustomer[];
}

export interface DunningAnalytics {
  pastDueSubscriptions: number;
  gracePeriodSubscriptions: number;
  subscriptionsInDunning: number;
  averageDunningAttempts: number;
  maxDunningAttempts: number;
  recoveredAfterDunning: number;
  cancelledAfterDunning: number;
}

export interface WebhookAnalytics {
  totalDeliveries: number;
  deliveredCount: number;
  failedCount: number;
  pendingCount: number;
  successRate: number;
}

export interface ActivityItem {
  id: string;
  eventType: string;
  aggregateType?: string;
  aggregateId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityListResponse {
  data: ActivityItem[];
  total: number;
}

export interface AnalyticsOverview {
  metrics: AnalyticsMetrics;
  payments: PaymentAnalytics;
  customers: CustomerAnalytics;
  dunning: DunningAnalytics;
  webhooks: WebhookAnalytics;
  planBreakdown: PlanAnalytics[];
}
