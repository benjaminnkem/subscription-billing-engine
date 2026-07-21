import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PortalSession } from './entities/portal-session.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Plan } from '../plans/entities/plan.entity';
import { Merchant } from '../merchants/entities/merchant.entity';
import { Payment } from '../payments/entities/payment.entity';
import { MailService } from '../mail/mail.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { generateRandomToken } from '../shared/utils';

type PortalMode = 'test' | 'live';

export interface PortalConfig {
  allowSwitchPlan: boolean;
  prorateOnSwitch: boolean;
  scheduleDowngradeAtPeriodEnd: boolean;
  allowCancellation: boolean;
  collectCancellationReason: boolean;
  enabledCancellationReasons: string[];
  offerPauseOrDowngradeBeforeCancel: boolean;
  allowPause: boolean;
  editableName: boolean;
  editablePhone: boolean;
  editablePaymentMethod: boolean;
  showInvoiceHistory: boolean;
  showPaymentHistory: boolean;
  portalHeader: string;
  redirectLink: string;
}

const DEFAULT_PORTAL_CONFIG: PortalConfig = {
  allowSwitchPlan: false,
  prorateOnSwitch: true,
  scheduleDowngradeAtPeriodEnd: false,
  allowCancellation: true,
  collectCancellationReason: false,
  enabledCancellationReasons: [
    'too_expensive',
    'missing_feature',
    'found_alternative',
    'no_longer_need',
    'switching_plan',
    'other',
  ],
  offerPauseOrDowngradeBeforeCancel: false,
  allowPause: true,
  editableName: true,
  editablePhone: true,
  editablePaymentMethod: false,
  showInvoiceHistory: true,
  showPaymentHistory: true,
  portalHeader: '',
  redirectLink: '',
};

@Injectable()
export class PortalService {
  private readonly logger = new Logger(PortalService.name);

  constructor(
    @InjectRepository(PortalSession)
    private portalSessionRepo: Repository<PortalSession>,
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
    @InjectRepository(Plan)
    private planRepo: Repository<Plan>,
    @InjectRepository(Merchant)
    private merchantRepo: Repository<Merchant>,
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    private mailService: MailService,
    private subscriptionsService: SubscriptionsService,
    private config: ConfigService,
  ) {}

  async requestLogin(
    email: string,
    merchantId: string,
    mode: PortalMode = 'live',
  ): Promise<{ sent: true }> {
    const customer = await this.customerRepo.findOne({
      where: { email: email.trim().toLowerCase(), merchantId },
    });

    const merchant = await this.merchantRepo.findOne({
      where: { id: merchantId },
    });

    // Always return success to avoid email enumeration
    if (!customer || !merchant) {
      this.logger.warn(
        `Portal login requested for unknown customer/merchant email=${email} merchantId=${merchantId}`,
      );
      return { sent: true };
    }

    const token = generateRandomToken(32);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const session = this.portalSessionRepo.create({
      merchantId,
      customerId: customer.id,
      token,
      expiresAt,
      mode,
    });
    await this.portalSessionRepo.save(session);

    const dashboardUrl =
      this.config.get<string>('dashboardUrl') ?? 'http://localhost:3000';
    const portalUrl = `${dashboardUrl}/portal/session/${token}`;
    const brandName = merchant.businessName || 'your merchant';

    const subject = `Access your subscriber portal for ${brandName}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 40px auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="font-size: 20px; font-weight: 600; color: #0f172a; margin: 0 0 12px;">Hello ${customer.name || 'there'},</h2>
        <p style="font-size: 15px; line-height: 1.55; color: #475569; margin: 0 0 8px;">
          Use the secure link below to open your subscription portal for <strong style="color:#0f172a">${brandName}</strong>.
        </p>
        <p style="font-size: 14px; line-height: 1.5; color: #64748b; margin: 0 0 24px;">
          Manage your plan, invoices, billing details, and more — no password needed.
        </p>
        <div style="margin: 28px 0;">
          <a href="${portalUrl}" style="display: inline-block; padding: 12px 22px; color: #fff; background: #0f172a; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 8px;">Open customer portal</a>
        </div>
        <p style="font-size: 12px; color: #94a3b8; line-height: 1.45; margin: 0;">
          This link is valid for 24 hours. If you did not request it, you can ignore this email.
        </p>
      </div>
    `;

    try {
      await this.mailService.sendRaw(customer.email, subject, html);
    } catch (error) {
      this.logger.error({ error }, 'Failed to send portal magic link email');
    }

    return { sent: true };
  }

  async getSessionState(token: string) {
    const session = await this.requireSession(token);

    const customer = await this.customerRepo.findOne({
      where: { id: session.customerId, merchantId: session.merchantId },
    });
    if (!customer) {
      throw new NotFoundException('Customer record not found.');
    }

    const subscription = await this.subscriptionRepo.findOne({
      where: { customerId: customer.id, merchantId: session.merchantId },
      relations: { plan: true },
      order: { updatedAt: 'DESC' },
    });

    const invoices = await this.invoiceRepo.find({
      where: { customerId: customer.id, merchantId: session.merchantId },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    const merchant = await this.merchantRepo.findOne({
      where: { id: session.merchantId },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found.');
    }

    const plans = await this.planRepo.find({
      where: { merchantId: session.merchantId, isActive: true },
      order: { amount: 'ASC' },
    });

    const payments = subscription
      ? await this.paymentRepo.find({
          where: {
            subscriptionId: subscription.id,
            merchantId: session.merchantId,
          },
          order: { createdAt: 'DESC' },
          take: 50,
        })
      : [];

    const config = this.resolvePortalConfig(
      merchant.customerPortalSettings,
      session.mode ?? 'live',
    );

    const branding = {
      ...(merchant.branding ?? {}),
      businessName:
        (merchant.branding?.businessName as string | undefined) ||
        merchant.businessName,
    };

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone ?? null,
        hasPaymentMethod: Boolean(customer.monnifyCardToken),
      },
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAt: subscription.cancelledAt ?? null,
            pausedAt: subscription.pausedAt ?? null,
            plan: subscription.plan
              ? {
                  id: subscription.plan.id,
                  name: subscription.plan.name,
                  amount: subscription.plan.amount,
                  currency: subscription.plan.currency,
                  description: subscription.plan.description ?? null,
                  interval: subscription.plan.interval,
                }
              : null,
          }
        : null,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        total: inv.total,
        currency: inv.currency,
        dueDate: inv.dueDate ?? null,
        paidAt: inv.paidAt ?? null,
        createdAt: inv.createdAt,
      })),
      payments: payments.map((pmt) => ({
        id: pmt.id,
        amount: pmt.amount,
        currency: pmt.currency,
        status: pmt.status,
        monnifyTransactionReference: pmt.monnifyTransactionReference ?? null,
        monnifyTransactionId: pmt.monnifyTransactionReference ?? null,
        monnifyPaymentReference: pmt.monnifyPaymentReference ?? null,
        failureReason: pmt.failureReason ?? null,
        paidAt: pmt.paidAt ?? null,
        createdAt: pmt.createdAt,
      })),
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? null,
        amount: p.amount,
        currency: p.currency,
        interval: p.interval,
      })),
      config,
      branding,
      mode: session.mode ?? 'live',
    };
  }

  async executeAction(token: string, action: string, data: any = {}) {
    const session = await this.requireSession(token);

    const customer = await this.customerRepo.findOne({
      where: { id: session.customerId, merchantId: session.merchantId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    const merchant = await this.merchantRepo.findOne({
      where: { id: session.merchantId },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found.');
    }

    const config = this.resolvePortalConfig(
      merchant.customerPortalSettings,
      session.mode ?? 'live',
    );

    const subscription = await this.subscriptionRepo.findOne({
      where: { customerId: customer.id, merchantId: session.merchantId },
      order: { updatedAt: 'DESC' },
    });

    switch (action) {
      case 'UPDATE_CONTACT': {
        if (!config.editableName && !config.editablePhone) {
          throw new BadRequestException(
            'Contact updates are disabled for this portal.',
          );
        }
        if (config.editableName && typeof data.name === 'string' && data.name.trim()) {
          customer.name = data.name.trim();
        }
        if (config.editablePhone && data.phone !== undefined) {
          customer.phone =
            typeof data.phone === 'string' ? data.phone.trim() : data.phone;
        }
        await this.customerRepo.save(customer);
        break;
      }
      case 'PAUSE_SUBSCRIPTION': {
        if (!config.allowPause) {
          throw new BadRequestException('Pausing is disabled for this portal.');
        }
        if (!subscription) {
          throw new BadRequestException('No active subscription found.');
        }
        await this.subscriptionsService.pause(
          session.merchantId,
          subscription.id,
          'customer',
        );
        break;
      }
      case 'RESUME_SUBSCRIPTION': {
        if (!subscription) {
          throw new BadRequestException('No active subscription found.');
        }
        await this.subscriptionsService.resume(
          session.merchantId,
          subscription.id,
          'customer',
        );
        break;
      }
      case 'CANCEL_SUBSCRIPTION': {
        if (!config.allowCancellation) {
          throw new BadRequestException(
            'Cancellation is disabled for this portal.',
          );
        }
        if (!subscription) {
          throw new BadRequestException('No active subscription found.');
        }
        const cancelled = await this.subscriptionsService.cancel(
          session.merchantId,
          subscription.id,
          'customer',
        );
        if (data.reason || data.cancelReason) {
          const reason = String(data.reason ?? data.cancelReason);
          cancelled.metadata = {
            ...(cancelled.metadata ?? {}),
            cancelReason: reason,
            cancelledVia: 'customer_portal',
          };
          await this.subscriptionRepo.save(cancelled);
        }
        break;
      }
      case 'REACTIVATE_SUBSCRIPTION': {
        if (!subscription) {
          throw new BadRequestException('No active subscription found.');
        }
        await this.subscriptionsService.reactivate(
          session.merchantId,
          subscription.id,
          'customer',
        );
        break;
      }
      case 'SWITCH_PLAN': {
        if (!config.allowSwitchPlan) {
          throw new BadRequestException(
            'Plan switching is disabled for this portal.',
          );
        }
        if (!subscription) {
          throw new BadRequestException('No active subscription found.');
        }
        if (!data.planId) {
          throw new BadRequestException('Missing target plan ID.');
        }
        await this.subscriptionsService.changePlan(
          session.merchantId,
          subscription.id,
          { newPlanId: data.planId },
          'customer',
        );
        break;
      }
      default:
        throw new BadRequestException(`Unknown action type: ${action}`);
    }

    if (!session.usedAt) {
      session.usedAt = new Date();
      await this.portalSessionRepo.save(session);
    }

    return this.getSessionState(token);
  }

  private async requireSession(token: string): Promise<PortalSession> {
    if (!token) {
      throw new BadRequestException('Missing portal session token.');
    }

    const session = await this.portalSessionRepo.findOne({
      where: { token },
    });

    if (!session) {
      throw new NotFoundException('Invalid or expired login link.');
    }

    if (session.expiresAt < new Date()) {
      throw new BadRequestException('This login link has expired.');
    }

    return session;
  }

  resolvePortalConfig(
    raw: Record<string, unknown> | null | undefined,
    mode: PortalMode,
  ): PortalConfig {
    if (!raw || typeof raw !== 'object') {
      return { ...DEFAULT_PORTAL_CONFIG };
    }

    const nested = raw[mode];
    const other = raw[mode === 'test' ? 'live' : 'test'];
    const candidate =
      nested && typeof nested === 'object' && !Array.isArray(nested)
        ? (nested as Record<string, unknown>)
        : other && typeof other === 'object' && !Array.isArray(other)
          ? (other as Record<string, unknown>)
          : raw;

    // Detect flat config (has allowSwitchPlan etc at top level)
    const looksNested =
      ('test' in raw || 'live' in raw) &&
      !('allowSwitchPlan' in raw) &&
      !('allowCancellation' in raw);

    const source = looksNested
      ? (candidate as Record<string, unknown>)
      : ('allowSwitchPlan' in raw || 'allowCancellation' in raw
          ? raw
          : candidate);

    return {
      ...DEFAULT_PORTAL_CONFIG,
      ...this.pickConfig(source),
    };
  }

  private pickConfig(source: Record<string, unknown>): Partial<PortalConfig> {
    const out: Partial<PortalConfig> = {};
    const boolKeys: (keyof PortalConfig)[] = [
      'allowSwitchPlan',
      'prorateOnSwitch',
      'scheduleDowngradeAtPeriodEnd',
      'allowCancellation',
      'collectCancellationReason',
      'offerPauseOrDowngradeBeforeCancel',
      'allowPause',
      'editableName',
      'editablePhone',
      'editablePaymentMethod',
      'showInvoiceHistory',
      'showPaymentHistory',
    ];

    for (const key of boolKeys) {
      if (typeof source[key] === 'boolean') {
        (out as Record<string, unknown>)[key] = source[key];
      }
    }

    if (Array.isArray(source.enabledCancellationReasons)) {
      out.enabledCancellationReasons =
        source.enabledCancellationReasons.filter(
          (v): v is string => typeof v === 'string',
        );
    }

    if (typeof source.portalHeader === 'string') {
      out.portalHeader = source.portalHeader;
    }
    if (typeof source.redirectLink === 'string') {
      out.redirectLink = source.redirectLink;
    }

    return out;
  }
}
