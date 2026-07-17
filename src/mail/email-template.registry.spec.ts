import { DOMAIN_EVENTS } from '../events/domain-events';
import { EventStore } from '../events/entities/event-store.entity';
import { EmailTemplateRegistry } from './email-template.registry';

describe('EmailTemplateRegistry', () => {
  const registry = new EmailTemplateRegistry();

  function buildEvent(
    eventType: string,
    payload: Record<string, unknown>,
  ): EventStore {
    return {
      eventType,
      payload,
    } as EventStore;
  }

  it('maps subscription created events', () => {
    const result = registry.resolve(
      buildEvent(DOMAIN_EVENTS.SUBSCRIPTION_CREATED, {
        customer: { name: 'Jane', email: 'jane@example.com' },
        plan: { name: 'Pro', amount: '5000.00', currency: 'NGN' },
      }),
    );

    expect(result?.template).toBe('emails/subscription-created');
    expect(result?.context.customerName).toBe('Jane');
    expect(result?.context.planName).toBe('Pro');
  });

  it('maps activated subscription updates only', () => {
    expect(
      registry.resolve(
        buildEvent(DOMAIN_EVENTS.SUBSCRIPTION_UPDATED, {
          activated: false,
        }),
      ),
    ).toBeNull();

    const result = registry.resolve(
      buildEvent(DOMAIN_EVENTS.SUBSCRIPTION_UPDATED, {
        activated: true,
        customer: { name: 'Jane' },
        plan: { name: 'Pro' },
      }),
    );

    expect(result?.template).toBe('emails/subscription-activated');
  });

  it('builds password reset template', () => {
    const result = registry.passwordReset({
      userName: 'Jane',
      resetUrl: 'http://localhost:3000/reset-password?token=abc',
    });

    expect(result.template).toBe('emails/password-reset');
    expect(result.context.resetUrl).toContain('token=abc');
  });
});
