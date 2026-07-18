import { Injectable } from '@nestjs/common';
import { DOMAIN_EVENTS } from '../domain-events';
import { EventStore } from '../entities/event-store.entity';
import {
  TimelineEvent,
  TimelineEventPresentation,
} from './dto/timeline-event.dto';

@Injectable()
export class EventPresentationService {
  toTimelineEvent(event: EventStore): TimelineEvent {
    return {
      id: event.id,
      timestamp: event.createdAt.toISOString(),
      type: event.eventType,
      aggregateType: event.aggregateType ?? '',
      aggregateId: event.aggregateId ?? '',
      merchantId: event.merchantId,
      correlationId: event.correlationId ?? null,
      category: event.category ?? 'Analytics',
      payload: event.payload,
      metadata: event.metadata ?? {},
      processed: event.processed,
      status: event.processed ? 'processed' : 'new',
      presentation: this.buildPresentation(event),
    };
  }

  private buildPresentation(event: EventStore): TimelineEventPresentation {
    const payload = event.payload ?? {};
    const isChaos = Boolean(event.metadata?.chaos);
    const chaosPrefix = isChaos ? '⚡ Chaos · ' : '';
    const subscription = payload.subscription as { id?: string } | undefined;
    const invoice = payload.invoice as { id?: string } | undefined;
    const payment = payload.payment as
      { id?: string; failureReason?: string } | undefined;

    const shortId = (id?: string) => (id ? `${id.slice(0, 8)}…` : undefined);

    switch (event.eventType) {
      case DOMAIN_EVENTS.SUBSCRIPTION_CREATED:
        return {
          title: 'Subscription Created',
          icon: 'repeat',
          severity: 'success',
          color: 'emerald',
          description: 'A new subscription was created and checkout initiated.',
          summary: shortId(subscription?.id ?? event.aggregateId),
        };

      case DOMAIN_EVENTS.SUBSCRIPTION_UPDATED:
        return {
          title: 'Subscription Updated',
          icon: 'repeat',
          severity: 'info',
          color: 'blue',
          description: payload.activated
            ? 'Subscription activated after successful payment.'
            : 'Subscription details were updated.',
          summary: shortId(subscription?.id ?? event.aggregateId),
        };

      case DOMAIN_EVENTS.SUBSCRIPTION_CANCELLED:
        return {
          title: 'Subscription Cancelled',
          icon: 'repeat',
          severity: 'warning',
          color: 'amber',
          description:
            'The subscription was cancelled by the merchant or customer.',
          summary: shortId(subscription?.id ?? event.aggregateId),
        };

      case DOMAIN_EVENTS.SUBSCRIPTION_RENEWED:
        return {
          title: 'Subscription Renewed',
          icon: 'repeat',
          severity: 'success',
          color: 'emerald',
          description: 'Billing period renewed successfully.',
          summary: shortId(subscription?.id ?? event.aggregateId),
        };

      case DOMAIN_EVENTS.INVOICE_GENERATED:
        return {
          title: 'Invoice Generated',
          icon: 'file-text',
          severity: 'info',
          color: 'blue',
          description: 'A new invoice was created for billing.',
          summary: shortId(invoice?.id ?? event.aggregateId),
        };

      case DOMAIN_EVENTS.INVOICE_PAID:
        return {
          title: 'Invoice Paid',
          icon: 'file-text',
          severity: 'success',
          color: 'emerald',
          description: 'Invoice payment was received and recorded.',
          summary: shortId(invoice?.id ?? event.aggregateId),
        };

      case DOMAIN_EVENTS.PAYMENT_STARTED:
        return {
          title: 'Payment Started',
          icon: 'credit-card',
          severity: 'info',
          color: 'blue',
          description: 'Payment charge initiated with Monnify.',
          summary: shortId(payment?.id ?? event.aggregateId),
        };

      case DOMAIN_EVENTS.PAYMENT_FAILED: {
        const reason =
          payment?.failureReason ??
          (payload.failureReason as string | undefined) ??
          'Unknown error';
        return {
          title: 'Payment Failed',
          icon: 'credit-card',
          severity: 'error',
          color: isChaos ? 'violet' : 'red',
          description: `${chaosPrefix}Payment could not be processed: ${reason}.`,
          summary: reason,
        };
      }

      case DOMAIN_EVENTS.PAYMENT_RECOVERED:
        return {
          title: 'Payment Recovered',
          icon: 'credit-card',
          severity: 'success',
          color: 'emerald',
          description:
            'A previously failed payment was successfully recovered.',
          summary: shortId(payment?.id ?? event.aggregateId),
        };

      case DOMAIN_EVENTS.RETRY_SCHEDULED: {
        const delayHours = payload.delayHours as number | undefined;
        const delayLabel =
          delayHours !== undefined
            ? delayHours >= 24
              ? `${Math.round(delayHours / 24)} days`
              : `${delayHours} hours`
            : 'scheduled';
        return {
          title: 'Retry Scheduled',
          icon: 'clock',
          severity: 'warning',
          color: 'amber',
          description: `Dunning retry scheduled in ${delayLabel}.`,
          summary: delayLabel,
        };
      }

      case DOMAIN_EVENTS.WEBHOOK_SENT: {
        const webhookType = payload.webhookEventType as string | undefined;
        return {
          title: 'Webhook Sent',
          icon: 'webhook',
          severity: 'info',
          color: 'violet',
          description: webhookType
            ? `${chaosPrefix}Webhook delivered for ${webhookType}.`
            : `${chaosPrefix}Webhook was delivered to merchant endpoint.`,
          summary: webhookType ?? shortId(event.aggregateId),
        };
      }

      case DOMAIN_EVENTS.CHAOS_SCENARIO_STARTED: {
        const scenarioId = payload.scenarioId as string | undefined;
        return {
          title: 'Chaos Scenario Started',
          icon: 'zap',
          severity: 'warning',
          color: 'violet',
          description: `${chaosPrefix}Demo scenario "${scenarioId ?? 'unknown'}" activated.`,
          summary: scenarioId,
        };
      }

      default:
        return {
          title: event.eventType
            .replace(/Event$/, '')
            .replace(/([A-Z])/g, ' $1')
            .trim(),
          icon: 'activity',
          severity: 'info',
          color: 'slate',
          description: `${event.eventType} occurred.`,
          summary: shortId(event.aggregateId),
        };
    }
  }
}
