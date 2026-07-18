import { DOMAIN_EVENTS } from '../events/domain-events';
import { EventStore } from '../events/entities/event-store.entity';
import { RecoveryLinkService } from '../recovery-channels/recovery-link.service';
import { EmailTemplateRegistry } from './email-template.registry';

describe('EmailTemplateRegistry', () => {
  const createLinksMock = jest.fn().mockResolvedValue({
    retryUrl: 'http://localhost:6555/recovery/email?token=retry',
    pauseUrl: 'http://localhost:6555/recovery/email?token=pause',
    cancelUrl: 'http://localhost:6555/recovery/email?token=cancel',
  });
  const recoveryLinkService = {
    createLinks: createLinksMock,
  } as unknown as RecoveryLinkService;

  const registry = new EmailTemplateRegistry(recoveryLinkService);

  function buildEvent(
    eventType: string,
    payload: Record<string, unknown>,
    merchantId = 'merchant-1',
  ): EventStore {
    return {
      eventType,
      payload,
      merchantId,
    } as EventStore;
  }

  it('maps subscription created events', async () => {
    const result = await registry.resolve(
      buildEvent(DOMAIN_EVENTS.SUBSCRIPTION_CREATED, {
        customer: { name: 'Jane', email: 'jane@example.com' },
        plan: { name: 'Pro', amount: '5000.00', currency: 'NGN' },
      }),
    );

    expect(result?.template).toBe('emails/subscription-created');
    expect(result?.context.customerName).toBe('Jane');
    expect(result?.context.planName).toBe('Pro');
  });

  it('maps activated subscription updates only', async () => {
    expect(
      await registry.resolve(
        buildEvent(DOMAIN_EVENTS.SUBSCRIPTION_UPDATED, {
          activated: false,
        }),
      ),
    ).toBeNull();

    const result = await registry.resolve(
      buildEvent(DOMAIN_EVENTS.SUBSCRIPTION_UPDATED, {
        activated: true,
        customer: { name: 'Jane' },
        plan: { name: 'Pro' },
      }),
    );

    expect(result?.template).toBe('emails/subscription-activated');
  });

  it('includes recovery-action links for a subscription-billed failure', async () => {
    const result = await registry.resolve(
      buildEvent(
        DOMAIN_EVENTS.PAYMENT_FAILED,
        {
          payment: { amount: '15000.00', currency: 'NGN' },
          invoice: { subscriptionId: 'sub-123', total: '15000.00' },
        },
        'merchant-1',
      ),
    );

    expect(createLinksMock).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      subscriptionId: 'sub-123',
    });
    expect(result?.context.retryUrl).toContain('token=retry');
    expect(result?.context.pauseUrl).toContain('token=pause');
    expect(result?.context.cancelUrl).toContain('token=cancel');
  });

  it('skips recovery links for a one-time charge with no subscription', async () => {
    const result = await registry.resolve(
      buildEvent(DOMAIN_EVENTS.PAYMENT_FAILED, {
        payment: { amount: '15000.00', currency: 'NGN' },
        invoice: { total: '15000.00' },
      }),
    );

    expect(result?.context.retryUrl).toBeUndefined();
  });

  it('still resolves the email if recovery-link generation fails', async () => {
    createLinksMock.mockRejectedValueOnce(
      new Error('relation "recovery_links" does not exist'),
    );

    const result = await registry.resolve(
      buildEvent(DOMAIN_EVENTS.PAYMENT_FAILED, {
        payment: { amount: '15000.00', currency: 'NGN' },
        invoice: { subscriptionId: 'sub-123', total: '15000.00' },
      }),
    );

    expect(result?.template).toBe('emails/payment-failed');
    expect(result?.context.retryUrl).toBeUndefined();
    expect(result?.context.pauseUrl).toBeUndefined();
    expect(result?.context.cancelUrl).toBeUndefined();
  });

  it('builds password reset template', () => {
    const result = registry.passwordReset({
      userName: 'Jane',
      resetUrl: 'http://localhost:3000/reset-password?token=abc',
    });

    expect(result.template).toBe('emails/password-reset');
    expect(result.context.resetUrl).toContain('token=abc');
  });

  it('builds welcome merchant template', () => {
    const result = registry.welcomeMerchant({
      userName: 'Jane',
      businessName: 'Acme Corp',
    });

    expect(result.template).toBe('emails/welcome-merchant');
    expect(result.subject).toBe('Welcome to Subflow!');
    expect(result.context.userName).toBe('Jane');
    expect(result.context.businessName).toBe('Acme Corp');
  });
});
