import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiWrappedResponse } from '../common/dto/api-response.dto';
import { CurrentMerchant } from '../common/decorators/current-merchant.decorator';
import { ChaosScenarioRunner } from './chaos-scenario.runner';
import { ChaosService } from './chaos.service';
import { CHAOS_SCENARIO_CATALOG } from './chaos.types';
import {
  ChaosRuleDto,
  ChaosScenarioCatalogItemDto,
  RunScenarioDto,
  RunScenarioResultDto,
  UpdateChaosRuleDto,
} from './dto/chaos.dto';

@ApiTags('Chaos')
@ApiBearerAuth()
@Controller('chaos')
export class ChaosController {
  constructor(
    private readonly chaosService: ChaosService,
    private readonly scenarioRunner: ChaosScenarioRunner,
  ) {}

  @Get('scenarios')
  @ApiOperation({ summary: 'List available chaos demo scenarios' })
  @ApiWrappedResponse({
    status: 200,
    type: ChaosScenarioCatalogItemDto,
    isArray: true,
    description: 'Chaos scenario catalog',
  })
  listScenarios() {
    return CHAOS_SCENARIO_CATALOG;
  }

  @Get('rules')
  @ApiOperation({ summary: 'Get active chaos rules for merchant' })
  @ApiWrappedResponse({
    status: 200,
    type: ChaosRuleDto,
    description: 'Current chaos configuration',
  })
  getRules(@CurrentMerchant() merchantId: string) {
    return this.chaosService.getRules(merchantId);
  }

  @Patch('rules')
  @ApiOperation({ summary: 'Update chaos rules manually' })
  @ApiWrappedResponse({
    status: 200,
    type: ChaosRuleDto,
    description: 'Updated chaos configuration',
  })
  updateRules(
    @CurrentMerchant() merchantId: string,
    @Body() dto: UpdateChaosRuleDto,
  ) {
    return this.chaosService.updateRules(merchantId, dto);
  }

  @Post('disable')
  @ApiOperation({ summary: 'Disable chaos mode' })
  @ApiWrappedResponse({
    status: 200,
    type: ChaosRuleDto,
    description: 'Chaos disabled',
  })
  disable(@CurrentMerchant() merchantId: string) {
    return this.chaosService.disable(merchantId);
  }

  @Post('scenarios/:scenarioId/run')
  @ApiOperation({ summary: 'Run a curated chaos demo scenario' })
  @ApiParam({ name: 'scenarioId', type: String })
  @ApiWrappedResponse({
    status: 200,
    type: RunScenarioResultDto,
    description: 'Scenario execution result',
  })
  runScenario(
    @CurrentMerchant() merchantId: string,
    @Param('scenarioId') scenarioId: string,
    @Body() dto: RunScenarioDto,
  ) {
    return this.scenarioRunner.run(merchantId, scenarioId, dto);
  }
}
