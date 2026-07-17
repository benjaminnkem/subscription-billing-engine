import { EmailRecipientResolver } from './email-recipient.resolver';
import { EventStore } from '../events/entities/event-store.entity';

describe('EmailRecipientResolver', () => {
  const resolver = new EmailRecipientResolver();

  function buildEvent(payload: Record<string, unknown>): EventStore {
    return {
      payload,
    } as EventStore;
  }

  it('reads nested customer email', () => {
    const email = resolver.resolve(
      buildEvent({
        customer: { email: 'jane@example.com', name: 'Jane' },
      }),
    );

    expect(email).toBe('jane@example.com');
  });

  it('reads subscription customer email', () => {
    const email = resolver.resolve(
      buildEvent({
        subscription: {
          customer: { email: 'john@example.com' },
        },
      }),
    );

    expect(email).toBe('john@example.com');
  });

  it('returns null when no recipient is available', () => {
    expect(
      resolver.resolve(buildEvent({ invoice: { total: '100.00' } })),
    ).toBeNull();
  });
});
