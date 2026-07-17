import { Injectable } from '@nestjs/common';
import { EventStore } from '../events/entities/event-store.entity';

type PayloadRecord = Record<string, unknown>;

function asRecord(value: unknown): PayloadRecord | null {
  return value && typeof value === 'object' ? (value as PayloadRecord) : null;
}

function readEmail(value: unknown): string | null {
  const record = asRecord(value);
  const email = record?.email;
  return typeof email === 'string' && email.length > 0 ? email : null;
}

@Injectable()
export class EmailRecipientResolver {
  resolve(event: EventStore): string | null {
    const payload = event.payload ?? {};

    const direct =
      (typeof payload.customerEmail === 'string' && payload.customerEmail) ||
      (typeof payload.email === 'string' && payload.email);
    if (direct) {
      return direct;
    }

    const customer = asRecord(payload.customer);
    if (customer) {
      const email = readEmail(customer);
      if (email) return email;
    }

    const subscription = asRecord(payload.subscription);
    const subscriptionCustomer = asRecord(subscription?.customer);
    if (subscriptionCustomer) {
      const email = readEmail(subscriptionCustomer);
      if (email) return email;
    }

    const invoice = asRecord(payload.invoice);
    const invoiceCustomer = asRecord(invoice?.customer);
    if (invoiceCustomer) {
      const email = readEmail(invoiceCustomer);
      if (email) return email;
    }

    return null;
  }
}
