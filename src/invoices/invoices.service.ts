import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceStatus } from '../shared/enums';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Invoice } from './entities/invoice.entity';
import { PaginationDto } from '../common/dto/pagination.dto';

export interface CreateInvoiceInput {
  merchantId: string;
  customerId: string;
  subscriptionId?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitAmount: number;
  }>;
  currency?: string;
}

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceItem) private itemRepo: Repository<InvoiceItem>,
  ) {}

  async create(input: CreateInvoiceInput): Promise<Invoice> {
    const currency = input.currency ?? 'NGN';

    const items = input.items.map((item) => {
      const total = item.unitAmount * item.quantity;

      return this.itemRepo.create({
        merchantId: input.merchantId,
        description: item.description,
        quantity: item.quantity,
        unitAmount: item.unitAmount.toFixed(2),
        totalAmount: total.toFixed(2),
      });
    });

    const subtotal = items.reduce(
      (sum, item) => sum + parseFloat(item.totalAmount),
      0,
    );

    const invoice = this.invoiceRepo.create({
      merchantId: input.merchantId,
      customerId: input.customerId,
      subscriptionId: input.subscriptionId,
      invoiceNumber: this.generateInvoiceNumber(),
      status: InvoiceStatus.PENDING,
      subtotal: subtotal.toFixed(2),
      tax: '0.00',
      total: subtotal.toFixed(2),
      currency,
      dueDate: new Date(),
      items,
    });

    return this.invoiceRepo.save(invoice);
  }

  async findAll(
    merchantId: string,
    { page = 1, limit = 20 }: PaginationDto,
  ): Promise<{ data: Invoice[]; total: number }> {
    const [data, total] = await this.invoiceRepo.findAndCount({
      where: { merchantId },
      relations: { items: true, customer: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findOne(merchantId: string, id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id, merchantId },
      relations: { items: true, customer: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async markPaid(invoice: Invoice): Promise<Invoice> {
    invoice.status = InvoiceStatus.PAID;
    invoice.paidAt = new Date();
    return this.invoiceRepo.save(invoice);
  }

  async markFailed(invoice: Invoice): Promise<Invoice> {
    invoice.status = InvoiceStatus.FAILED;
    return this.invoiceRepo.save(invoice);
  }

  private generateInvoiceNumber(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `INV-${ts}-${rand}`;
  }
}
