import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PortalCustomerResponseDto {
  @ApiProperty({ example: 'c1a2b3d4-...' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiPropertyOptional({ example: '+2348030000000' })
  phone?: string;
}

export class PortalPlanResponseDto {
  @ApiProperty({ example: 'p1a2b3d4-...' })
  id: string;

  @ApiProperty({ example: 'Gold Monthly' })
  name: string;

  @ApiPropertyOptional({ example: 'Access to all premium features' })
  description?: string;

  @ApiProperty({ example: '5000.00' })
  amount: string;

  @ApiProperty({ example: 'NGN' })
  currency: string;
}

export class PortalSubscriptionResponseDto {
  @ApiProperty({ example: 's1a2b3d4-...' })
  id: string;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty({ example: '2026-07-07T12:00:00.000Z' })
  currentPeriodStart: Date;

  @ApiProperty({ example: '2026-08-07T12:00:00.000Z' })
  currentPeriodEnd: Date;

  @ApiProperty({ type: () => PortalPlanResponseDto })
  plan: PortalPlanResponseDto;
}

export class PortalInvoiceResponseDto {
  @ApiProperty({ example: 'i1a2b3d4-...' })
  id: string;

  @ApiProperty({ example: 'INV-100234' })
  invoiceNumber: string;

  @ApiProperty({ example: 'paid' })
  status: string;

  @ApiProperty({ example: '5000.00' })
  total: string;

  @ApiProperty({ example: 'NGN' })
  currency: string;

  @ApiPropertyOptional({ example: '2026-08-07T12:00:00.000Z' })
  dueDate?: Date | null;

  @ApiPropertyOptional({ example: '2026-07-07T12:00:00.000Z' })
  paidAt?: Date | null;
}

export class PortalPaymentResponseDto {
  @ApiProperty({ example: 'pmt_1a2b3d4...' })
  id: string;

  @ApiProperty({ example: '5000.00' })
  amount: string;

  @ApiProperty({ example: 'NGN' })
  currency: string;

  @ApiProperty({ example: 'success' })
  status: string;

  @ApiPropertyOptional({ example: 'MNFY|65|20240718123000|000001' })
  monnifyTransactionReference?: string;

  @ApiPropertyOptional({ example: 'Insufficient funds' })
  failureReason?: string;

  @ApiPropertyOptional({ example: '2026-07-07T12:00:00.000Z' })
  paidAt?: Date | null;

  @ApiProperty({ example: '2026-07-07T12:00:00.000Z' })
  createdAt: Date;
}

export class PortalSessionResponseDto {
  @ApiProperty({ type: PortalCustomerResponseDto })
  customer: PortalCustomerResponseDto;

  @ApiPropertyOptional({ type: PortalSubscriptionResponseDto, nullable: true })
  subscription: PortalSubscriptionResponseDto | null;

  @ApiProperty({ type: [PortalInvoiceResponseDto] })
  invoices: PortalInvoiceResponseDto[];

  @ApiProperty({ type: [PortalPaymentResponseDto] })
  payments: PortalPaymentResponseDto[];

  @ApiProperty({ type: [PortalPlanResponseDto] })
  plans: PortalPlanResponseDto[];

  @ApiProperty({ type: 'object', additionalProperties: true })
  config: Record<string, any>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  branding: Record<string, any>;
}
