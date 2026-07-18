import { Injectable } from '@nestjs/common';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { EventStore } from '../events/entities/event-store.entity';

export interface EmailTemplateDefinition {
  template: string;
  subject: string;
  context: Record<string, unknown>;
}

type PayloadRecord = Record<string, unknown>;

function asRecord(value: unknown): PayloadRecord | null {
  return value && typeof value === 'object' ? (value as PayloadRecord) : null;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function formatAmount(amount: unknown, currency = 'NGN'): string | undefined {
  if (amount === undefined || amount === null) return undefined;
  const numeric =
    typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (Number.isNaN(numeric)) return undefined;

  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(numeric);
}

@Injectable()
export class EmailTemplateRegistry {
  resolve(event: EventStore): EmailTemplateDefinition | null {
    const payload = event.payload ?? {};

    switch (event.eventType) {
      case DOMAIN_EVENTS.SUBSCRIPTION_CREATED:
        return this.subscriptionCreated(payload);
      case DOMAIN_EVENTS.SUBSCRIPTION_UPDATED:
        return payload.activated === true
          ? this.subscriptionActivated(payload)
          : null;
      case DOMAIN_EVENTS.SUBSCRIPTION_CANCELLED:
        return this.subscriptionCancelled(payload);
      case DOMAIN_EVENTS.SUBSCRIPTION_RENEWED:
        return this.subscriptionRenewed(payload);
      case DOMAIN_EVENTS.INVOICE_PAID:
        return this.invoicePaid(payload);
      case DOMAIN_EVENTS.PAYMENT_FAILED:
        return this.paymentFailed(payload);
      case DOMAIN_EVENTS.PAYMENT_RECOVERED:
        return this.paymentRecovered(payload);
      default:
        return null;
    }
  }

  passwordReset(context: {
    userName: string;
    resetUrl: string;
  }): EmailTemplateDefinition {
    return {
      template: 'emails/password-reset',
      subject: 'Reset your password',
      context,
    };
  }

  welcomeMerchant(context: {
    userName: string;
    businessName: string;
  }): EmailTemplateDefinition {
    return {
      template: 'emails/welcome-merchant',
      subject: 'Welcome to Subflow!',
      context,
    };
  }

  private subscriptionCreated(payload: PayloadRecord): EmailTemplateDefinition {
    const customer = asRecord(payload.customer);
    const plan = asRecord(payload.plan);

    return {
      template: 'emails/subscription-created',
      subject: 'Complete your subscription',
      context: {
        customerName: readString(customer?.name) ?? 'there',
        planName: readString(plan?.name) ?? 'your plan',
        amount: formatAmount(plan?.amount, readString(plan?.currency)),
      },
    };
  }

  private subscriptionActivated(
    payload: PayloadRecord,
  ): EmailTemplateDefinition {
    const customer =
      asRecord(payload.customer) ??
      asRecord(asRecord(payload.subscription)?.customer);
    const plan =
      asRecord(payload.plan) ?? asRecord(asRecord(payload.subscription)?.plan);

    return {
      template: 'emails/subscription-activated',
      subject: 'Your subscription is now active',
      context: {
        customerName: readString(customer?.name) ?? 'there',
        planName: readString(plan?.name) ?? 'your plan',
      },
    };
  }

  private subscriptionCancelled(
    payload: PayloadRecord,
  ): EmailTemplateDefinition {
    const subscription = asRecord(payload.subscription);
    const customer = asRecord(subscription?.customer);

    return {
      template: 'emails/subscription-cancelled',
      subject: 'Your subscription has been cancelled',
      context: {
        customerName: readString(customer?.name) ?? 'there',
      },
    };
  }

  private subscriptionRenewed(payload: PayloadRecord): EmailTemplateDefinition {
    const subscription = asRecord(payload.subscription);
    const customer = asRecord(subscription?.customer);
    const plan = asRecord(subscription?.plan);
    const invoice = asRecord(payload.invoice);

    return {
      template: 'emails/subscription-renewed',
      subject: 'Your subscription has been renewed',
      context: {
        customerName: readString(customer?.name) ?? 'there',
        planName: readString(plan?.name) ?? 'your plan',
        amount: formatAmount(
          invoice?.total ?? plan?.amount,
          readString(invoice?.currency) ?? readString(plan?.currency),
        ),
      },
    };
  }

  private invoicePaid(payload: PayloadRecord): EmailTemplateDefinition {
    const invoice = asRecord(payload.invoice);
    const payment = asRecord(payload.payment);
    const subscription = asRecord(payload.subscription);
    const customer = asRecord(subscription?.customer);

    return {
      template: 'emails/invoice-paid',
      subject: 'Payment received — thank you',
      context: {
        customerName: readString(customer?.name) ?? 'there',
        amount: formatAmount(
          invoice?.total ?? payment?.amount,
          readString(invoice?.currency) ?? readString(payment?.currency),
        ),
        invoiceNumber: readString(invoice?.invoiceNumber),
      },
    };
  }

  private paymentFailed(payload: PayloadRecord): EmailTemplateDefinition {
    const payment = asRecord(payload.payment);
    const invoice = asRecord(payload.invoice);

    return {
      template: 'emails/payment-failed',
      subject: 'Action required: payment failed',
      context: {
        customerName: 'there',
        amount: formatAmount(
          payment?.amount ?? invoice?.total,
          readString(payment?.currency) ?? readString(invoice?.currency),
        ),
        failureReason: readString(payment?.failureReason),
      },
    };
  }

  private paymentRecovered(payload: PayloadRecord): EmailTemplateDefinition {
    const payment = asRecord(payload.payment);
    const invoice = asRecord(payload.invoice);

    return {
      template: 'emails/payment-recovered',
      subject: 'Your payment was successful',
      context: {
        customerName: 'there',
        amount: formatAmount(
          payment?.amount ?? invoice?.total,
          readString(payment?.currency) ?? readString(invoice?.currency),
        ),
      },
    };
  }
}
