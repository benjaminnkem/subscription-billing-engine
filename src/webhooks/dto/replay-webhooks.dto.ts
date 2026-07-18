import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ReplayWebhooksDto {
  @ApiPropertyOptional({
    description:
      'Only replay events for this subscription (matched on the event’s aggregateId).',
  })
  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @ApiPropertyOptional({
    description: 'Start date (ISO 8601). Omit for no lower bound.',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601). Omit for no upper bound.',
    example: '2026-01-31',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
