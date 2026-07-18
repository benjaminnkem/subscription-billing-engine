import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TimelineEventPresentationDto {
  @ApiProperty()
  title: string;

  @ApiProperty()
  icon: string;

  @ApiProperty({ enum: ['info', 'success', 'warning', 'error'] })
  severity: string;

  @ApiProperty()
  color: string;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional()
  summary?: string;
}

export class TimelineEventDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  timestamp: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  aggregateType: string;

  @ApiProperty()
  aggregateId: string;

  @ApiProperty()
  merchantId: string;

  @ApiPropertyOptional({ nullable: true })
  correlationId: string | null;

  @ApiProperty()
  category: string;

  @ApiProperty({ type: Object })
  payload: Record<string, unknown>;

  @ApiProperty({ type: Object })
  metadata: Record<string, unknown>;

  @ApiProperty()
  processed: boolean;

  @ApiProperty({ enum: ['new', 'processed'] })
  status: string;

  @ApiProperty({ type: TimelineEventPresentationDto })
  presentation: TimelineEventPresentationDto;
}

export class TimelineEventsResponseDto {
  @ApiProperty({ type: [TimelineEventDto] })
  data: TimelineEventDto[];

  @ApiPropertyOptional({ nullable: true })
  nextCursor: string | null;

  @ApiProperty()
  hasMore: boolean;
}
