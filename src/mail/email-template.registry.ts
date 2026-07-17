import { Injectable, Logger } from '@nestjs/common';

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
  private readonly logger = new Logger(EmailTemplateRegistry.name);

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
      subject: 'Welcome to Monnify!',
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
}
