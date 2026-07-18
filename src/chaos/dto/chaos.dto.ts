import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import {
  CHAOS_SCENARIO_CATALOG,
  ChaosRule,
  ChaosScenario,
} from '../chaos.types';

export enum ChaosModeDto {
  PERSISTENT = 'persistent',
  ONE_SHOT = 'one-shot',
}

export class ChaosRuleDto implements ChaosRule {
  @ApiProperty()
  enabled: boolean;

  @ApiPropertyOptional({ enum: ChaosScenario, nullable: true })
  scenario?: ChaosScenario | null;

  @ApiPropertyOptional({ enum: ChaosScenario, isArray: true })
  scenarioQueue?: ChaosScenario[];

  @ApiProperty({ enum: ChaosModeDto })
  mode: ChaosModeDto;

  @ApiPropertyOptional()
  accelerateDunning?: boolean;

  @ApiPropertyOptional()
  failWebhooks?: boolean;

  @ApiPropertyOptional()
  slowGatewayMs?: number;

  @ApiPropertyOptional({ nullable: true })
  expiresAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  activeScenarioId?: string | null;
}

export class UpdateChaosRuleDto {
  @ApiPropertyOptional()
  enabled?: boolean;

  @ApiPropertyOptional({ enum: ChaosScenario, nullable: true })
  scenario?: ChaosScenario | null;

  @ApiPropertyOptional({ enum: ChaosScenario, isArray: true })
  scenarioQueue?: ChaosScenario[];

  @ApiPropertyOptional({ enum: ChaosModeDto })
  mode?: ChaosModeDto;

  @ApiPropertyOptional()
  accelerateDunning?: boolean;

  @ApiPropertyOptional()
  failWebhooks?: boolean;

  @ApiPropertyOptional()
  slowGatewayMs?: number;
}

export class RunScenarioDto {
  @ApiPropertyOptional({ description: 'Subscription to target for payment scenarios' })
  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @ApiPropertyOptional({ description: 'Payment to target for webhook scenarios' })
  @IsOptional()
  @IsUUID()
  paymentId?: string;
}

export class ChaosScenarioCatalogItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  icon: string;
}

export class RunScenarioResultDto {
  @ApiProperty()
  scenarioId: string;

  @ApiPropertyOptional()
  subscriptionId?: string;

  @ApiPropertyOptional()
  paymentId?: string;

  @ApiPropertyOptional({ nullable: true })
  correlationId?: string | null;

  @ApiProperty()
  message: string;
}

export { CHAOS_SCENARIO_CATALOG };