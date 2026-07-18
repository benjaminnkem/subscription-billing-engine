import { Injectable } from '@nestjs/common';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { EventStore } from '../events/entities/event-store.entity';

export interface RecoveryMessage {
  subject: string;
  body: string;
}

type PayloadRecord = Record<string, unknown>;

function asRecord(value: unknown): PayloadRecord | null {
  return value && typeof value === 'object' ? (value as PayloadRecord) : null;
}

function formatAmount(amount: unknown, currency = 'NGN'): string {
  const numeric =
    typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (Number.isNaN(numeric)) return 'your payment';

  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(numeric);
}

@Injectable()
export class RecoveryMessageBuilder {
  resolve(event: EventStore): RecoveryMessage | null {
    const payload = event.payload ?? {};

    switch (event.eventType) {
      case DOMAIN_EVENTS.PAYMENT_FAILED:
        return this.paymentFailed(payload);
      case DOMAIN_EVENTS.PAYMENT_RECOVERED:
        return this.paymentRecovered(payload);
      default:
        return null;
    }
  }

  private paymentFailed(payload: PayloadRecord): RecoveryMessage {
    const payment = asRecord(payload.payment);
    const invoice = asRecord(payload.invoice);
    const amount = formatAmount(
      payment?.amount ?? invoice?.total,
      typeof payment?.currency === 'string'
        ? payment.currency
        : typeof invoice?.currency === 'string'
          ? invoice.currency
          : undefined,
    );

    return {
      subject: 'Payment failed',
      body: `Your payment of ${amount} didn't go through. Reply RETRY to try again, PAUSE to pause your subscription, or CANCEL to cancel.`,
    };
  }

  private paymentRecovered(payload: PayloadRecord): RecoveryMessage {
    const payment = asRecord(payload.payment);
    const invoice = asRecord(payload.invoice);
    const amount = formatAmount(
      payment?.amount ?? invoice?.total,
      typeof payment?.currency === 'string'
        ? payment.currency
        : typeof invoice?.currency === 'string'
          ? invoice.currency
          : undefined,
    );

    return {
      subject: 'Payment recovered',
      body: `Payment of ${amount} succeeded — your subscription is active again.`,
    };
  }
}
