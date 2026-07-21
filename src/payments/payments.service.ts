import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CustomersService } from '../customers/customers.service';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { EventsService } from '../events/events.service';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoicesService } from '../invoices/invoices.service';
import { InvoiceStatus, PaymentStatus } from '../shared/enums';
import { PaymentAttempt } from './entities/payment-attempt.entity';
import { Payment } from './entities/payment.entity';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { MonnifyService } from './monnify.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(PaymentAttempt)
    private attemptRepo: Repository<PaymentAttempt>,
    private monnifyService: MonnifyService,
    private customersService: CustomersService,
    private invoicesService: InvoicesService,
    private eventsService: EventsService,
  ) {}

  async createCheckout(
    merchantId: string,
    dto: CreateCheckoutDto,
  ): Promise<{ checkoutUrl: string; paymentId: string }> {
    const invoice = await this.invoicesService.findOne(
      merchantId,
      dto.invoiceId,
    );
    if (invoice.status !== InvoiceStatus.PENDING) {
      throw new BadRequestException('Invoice is not pending payment');
    }

    const customer = await this.customersService.findOne(
      merchantId,
      invoice.customerId,
    );

    // Use payment.id as Monnify paymentReference so webhooks can match by id
    const payment = await this.paymentRepo.save(
      this.paymentRepo.create({
        merchantId,
        invoiceId: invoice.id,
        subscriptionId: invoice.subscriptionId,
        amount: invoice.total,
        currency: invoice.currency,
        status: PaymentStatus.PENDING,
      }),
    );

    const paymentReference = payment.id;
    // Persist reference up front so a webhook that races checkout still matches
    payment.monnifyPaymentReference = paymentReference;
    await this.paymentRepo.save(payment);

    const result = await this.monnifyService.createCheckout({
      paymentReference,
      amountNaira: parseFloat(invoice.total),
      currency: invoice.currency,
      redirectUrl: dto.callbackUrl,
      customerName: customer.name,
      customerEmail: customer.email,
      paymentDescription: `Invoice ${invoice.id}`,
    });

    if (!result.success || !result.checkoutUrl) {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason =
        result.failureReason ?? 'Checkout creation failed';
      await this.paymentRepo.save(payment);
      throw new BadRequestException(payment.failureReason);
    }

    payment.monnifyPaymentReference =
      result.paymentReference ?? paymentReference;
    payment.monnifyTransactionReference = result.transactionReference;
    await this.paymentRepo.save(payment);

    return { checkoutUrl: result.checkoutUrl, paymentId: payment.id };
  }

  async chargeInvoice(invoice: Invoice): Promise<Payment> {
    const customer = await this.customersService.findOne(
      invoice.merchantId,
      invoice.customerId,
    );

    if (!customer.monnifyCardToken) {
      const payment = await this.paymentRepo.save(
        this.paymentRepo.create({
          merchantId: invoice.merchantId,
          invoiceId: invoice.id,
          subscriptionId: invoice.subscriptionId,
          amount: invoice.total,
          currency: invoice.currency,
          status: PaymentStatus.FAILED,
          failureReason:
            'No saved payment method — create a checkout session first',
        }),
      );

      await this.eventsService.emit(DOMAIN_EVENTS.PAYMENT_FAILED, {
        merchantId: invoice.merchantId,
        aggregateType: 'payment',
        aggregateId: payment.id,
        data: { payment, invoice },
      });

      return payment;
    }

    const payment = this.paymentRepo.create({
      merchantId: invoice.merchantId,
      invoiceId: invoice.id,
      subscriptionId: invoice.subscriptionId,
      amount: invoice.total,
      currency: invoice.currency,
      status: PaymentStatus.PENDING,
    });
    const savedPayment = await this.paymentRepo.save(payment);

    const attemptNumber = 1;
    const result = await this.monnifyService.charge({
      amountNaira: parseFloat(invoice.total),
      currency: invoice.currency,
      customerName: customer.name,
      customerEmail: customer.email,
      cardToken: customer.monnifyCardToken,
      paymentId: savedPayment.id,
      attemptNumber,
      paymentDescription: `Invoice ${invoice.id}`,
    });

    const attempt = this.attemptRepo.create({
      merchantId: invoice.merchantId,
      paymentId: savedPayment.id,
      attemptNumber,
      status: result.success ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED,
      monnifyTransactionReference: result.transactionReference,
      monnifyPaymentReference: result.paymentReference,
      failureReason: result.failureReason,
      responsePayload: {
        ...result.raw,
        paymentReference: result.paymentReference,
      },
    });
    await this.attemptRepo.save(attempt);

    savedPayment.status = attempt.status;
    savedPayment.monnifyTransactionReference = result.transactionReference;
    savedPayment.monnifyPaymentReference = result.paymentReference;
    savedPayment.failureReason = result.failureReason;
    if (result.success) {
      savedPayment.paidAt = new Date();
    }
    const updated = await this.paymentRepo.save(savedPayment);

    if (!result.success) {
      await this.eventsService.emit(DOMAIN_EVENTS.PAYMENT_FAILED, {
        merchantId: invoice.merchantId,
        aggregateType: 'payment',
        aggregateId: updated.id,
        data: { payment: updated, invoice },
      });
    }

    return updated;
  }

  async findAll(
    merchantId: string,
    { page = 1, limit = 20 }: PaginationDto,
  ): Promise<{ data: Payment[]; total: number }> {
    const [data, total] = await this.paymentRepo.findAndCount({
      where: { merchantId },
      relations: { attempts: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findOne(merchantId: string, id: string): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { id, merchantId },
      relations: { attempts: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async recordRecovery(payment: Payment, invoice: Invoice): Promise<void> {
    await this.eventsService.emit(DOMAIN_EVENTS.PAYMENT_RECOVERED, {
      merchantId: payment.merchantId,
      aggregateType: 'payment',
      aggregateId: payment.id,
      data: { payment, invoice },
    });
  }
}
