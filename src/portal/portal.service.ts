import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
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

@Injectable()
export class PortalService {
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

  async requestLogin(email: string, merchantId: string): Promise<void> {
    const customer = await this.customerRepo.findOne({
      where: { email: email.trim().toLowerCase(), merchantId },
    });

    if (!customer) {
      throw new NotFoundException('No customer account found with that email.');
    }

    const merchant = await this.merchantRepo.findOne({
      where: { id: merchantId },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found.');
    }

    const token = generateRandomToken(32);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const session = this.portalSessionRepo.create({
      merchantId,
      customerId: customer.id,
      token,
      expiresAt,
    });
    await this.portalSessionRepo.save(session);

    const dashboardUrl =
      this.config.get<string>('dashboardUrl') ?? 'http://localhost:3000';
    const portalUrl = `${dashboardUrl}/portal/session/${token}`;

    const subject = `Access your subscriber portal for ${merchant.businessName}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 40px auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="font-size: 20px; font-weight: 600; color: #1a202c; margin-bottom: 16px;">Hello ${customer.name || 'there'},</h2>
        <p style="font-size: 15px; line-height: 1.5; color: #4a5568;">Use the link below to access your subscription portal for <strong>${merchant.businessName}</strong>. From the portal, you can manage your plan, pause or cancel billing, update your details, and view past invoices.</p>
        <div style="margin: 32px 0;">
          <a href="${portalUrl}" style="display: inline-block; padding: 12px 24px; color: #fff; background: #0052FF; text-decoration: none; font-weight: 500; font-size: 15px; border-radius: 6px;">Access Customer Portal</a>
        </div>
        <p style="font-size: 13px; color: #718096; line-height: 1.4;">This link is secure and valid for 24 hours. If you did not request this link, you can safely ignore this email.</p>
      </div>
    `;

    await this.mailService.sendRaw(customer.email, subject, html);
  }

  async getSessionState(token: string) {
    const session = await this.portalSessionRepo.findOne({
      where: { token },
    });

    if (!session) {
      throw new NotFoundException('Invalid or expired login link.');
    }

    if (session.expiresAt < new Date()) {
      throw new BadRequestException('This login link has expired.');
    }

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
    });

    const merchant = await this.merchantRepo.findOne({
      where: { id: session.merchantId },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found.');
    }

    const plans = await this.planRepo.find({
      where: { merchantId: session.merchantId, isActive: true },
    });

    const payments = subscription
      ? await this.paymentRepo.find({
          where: { subscriptionId: subscription.id, merchantId: session.merchantId },
          order: { createdAt: 'DESC' },
        })
      : [];

    return {
      customer,
      subscription,
      invoices,
      payments,
      plans,
      config: merchant.customerPortalSettings ?? {},
      branding: merchant.branding ?? {},
    };
  }

  async executeAction(token: string, action: string, data: any) {
    const session = await this.portalSessionRepo.findOne({
      where: { token },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new BadRequestException('Session has expired or is invalid.');
    }

    const customer = await this.customerRepo.findOne({
      where: { id: session.customerId, merchantId: session.merchantId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    const subscription = await this.subscriptionRepo.findOne({
      where: { customerId: customer.id, merchantId: session.merchantId },
      order: { updatedAt: 'DESC' },
    });

    switch (action) {
      case 'UPDATE_CONTACT': {
        if (data.name) {
          customer.name = data.name.trim();
        }
        if (data.phone !== undefined) {
          customer.phone = data.phone;
        }
        await this.customerRepo.save(customer);
        break;
      }
      case 'PAUSE_SUBSCRIPTION': {
        if (!subscription)
          throw new BadRequestException('No active subscription found.');
        await this.subscriptionsService.pause(
          session.merchantId,
          subscription.id,
          'customer',
        );
        break;
      }
      case 'RESUME_SUBSCRIPTION': {
        if (!subscription)
          throw new BadRequestException('No active subscription found.');
        await this.subscriptionsService.resume(
          session.merchantId,
          subscription.id,
          'customer',
        );
        break;
      }
      case 'CANCEL_SUBSCRIPTION': {
        if (!subscription)
          throw new BadRequestException('No active subscription found.');
        await this.subscriptionsService.cancel(
          session.merchantId,
          subscription.id,
          'customer',
        );
        break;
      }
      case 'REACTIVATE_SUBSCRIPTION': {
        if (!subscription)
          throw new BadRequestException('No active subscription found.');
        await this.subscriptionsService.reactivate(
          session.merchantId,
          subscription.id,
          'customer',
        );
        break;
      }
      case 'SWITCH_PLAN': {
        if (!subscription)
          throw new BadRequestException('No active subscription found.');
        if (!data.planId)
          throw new BadRequestException('Missing target plan ID.');
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

    return this.getSessionState(token);
  }
}
