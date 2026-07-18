export const DOMAIN_EVENTS = {
  SUBSCRIPTION_CREATED: 'SubscriptionCreatedEvent',
  SUBSCRIPTION_UPDATED: 'SubscriptionUpdatedEvent',
  SUBSCRIPTION_CANCELLED: 'SubscriptionCancelledEvent',
  SUBSCRIPTION_RENEWED: 'SubscriptionRenewedEvent',
  PAYMENT_FAILED: 'PaymentFailedEvent',
  PAYMENT_RECOVERED: 'PaymentRecoveredEvent',
  PAYMENT_STARTED: 'PaymentStartedEvent',
  INVOICE_PAID: 'InvoicePaidEvent',
  INVOICE_GENERATED: 'InvoiceGeneratedEvent',
  RETRY_SCHEDULED: 'RetryScheduledEvent',
  WEBHOOK_SENT: 'WebhookSentEvent',
  CHAOS_SCENARIO_STARTED: 'ChaosScenarioStartedEvent',
} as const;

export type DomainEventType =
  (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

export interface EventMetadata {
  requestId?: string;
  ip?: string;
  userAgent?: string;
  source?: string;
  version?: string;
  environment?: string;
  chaos?: boolean;
  chaosScenario?: string | null;
  chaosMode?: string;
}

export interface DomainEventPayload {
  merchantId: string;
  aggregateType: string;
  aggregateId: string;
  correlationId?: string;
  data: Record<string, unknown>;
  metadata?: EventMetadata;
}
