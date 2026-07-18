import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PlanInterval } from '../../shared/enums';

export class CreatePlanDto {
  @ApiProperty({ example: 'Monthly Premium Plan' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Premium plan to access all features' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ default: 'NGN' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ enum: PlanInterval, example: PlanInterval.MONTHLY })
  @IsEnum(PlanInterval)
  interval: PlanInterval;

  @ApiPropertyOptional({ default: 0, example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  customIntervalDays?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
