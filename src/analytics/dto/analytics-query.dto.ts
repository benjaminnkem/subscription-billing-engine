import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum TrendGranularity {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class AnalyticsTrendQueryDto {
  @ApiPropertyOptional({
    description: 'Start date (ISO 8601). Defaults to 30 days ago.',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601). Defaults to today.',
    example: '2026-01-31',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    enum: ['day', 'week', 'month'],
    default: 'day',
    description: 'Bucket size for trend data',
  })
  @IsOptional()
  @IsEnum(TrendGranularity)
  granularity?: TrendGranularity = TrendGranularity.DAY;
}

export class AnalyticsActivityQueryDto extends PaginationDto {}
