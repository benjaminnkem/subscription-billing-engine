import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '../../shared/enums';

export class InvoiceItemResponseDto {
  @ApiProperty({ description: 'Item UUID' })
  id: string;

  @ApiProperty({ description: 'Invoice UUID' })
  invoiceId: string;

  @ApiProperty({ description: 'Description of the item' })
  description: string;

  @ApiProperty({ description: 'Quantity' })
  quantity: number;

  @ApiProperty({ description: 'Unit amount' })
  unitAmount: string;

  @ApiProperty({ description: 'Total amount' })
  totalAmount: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last updated timestamp' })
  updatedAt: Date;
}

export class InvoiceResponseDto {
  @ApiProperty({ description: 'Invoice UUID' })
  id: string;

  @ApiProperty({ description: 'Customer UUID' })
  customerId: string;

  @ApiPropertyOptional({ description: 'Subscription UUID' })
  subscriptionId?: string;

  @ApiProperty({ description: 'Unique invoice number' })
  invoiceNumber: string;

  @ApiProperty({ enum: InvoiceStatus, description: 'Invoice status' })
  status: InvoiceStatus;

  @ApiProperty({ description: 'Subtotal' })
  subtotal: string;

  @ApiProperty({ description: 'Tax amount' })
  tax: string;

  @ApiProperty({ description: 'Total amount' })
  total: string;

  @ApiProperty({ description: 'Currency code', example: 'NGN' })
  currency: string;

  @ApiPropertyOptional({ description: 'Due date' })
  dueDate?: Date | null;

  @ApiPropertyOptional({ description: 'Paid at timestamp' })
  paidAt?: Date | null;

  @ApiProperty({ type: [InvoiceItemResponseDto], description: 'Invoice items' })
  items: InvoiceItemResponseDto[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last updated timestamp' })
  updatedAt: Date;
}

export class InvoiceListResponseDto {
  @ApiProperty({ type: [InvoiceResponseDto] })
  data: InvoiceResponseDto[];

  @ApiProperty({ description: 'Total number of invoices' })
  total: number;
}
