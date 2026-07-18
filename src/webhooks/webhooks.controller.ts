import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiWrappedResponse } from '../common/dto/api-response.dto';
import { CurrentMerchant } from '../common/decorators/current-merchant.decorator';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { ReplayWebhooksDto } from './dto/replay-webhooks.dto';
import { WebhooksService } from './webhooks.service';
import {
  WebhookResponseDto,
  WebhookListResponseDto,
  WebhookDeliveryListResponseDto,
  ReplayWebhooksResponseDto,
} from './dto/webhook-response.dto';

@ApiTags('Webhooks')
@ApiBearerAuth()
@Controller('webhooks')
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Post()
  @ApiOperation({ summary: 'Register a webhook endpoint' })
  @ApiBody({ type: CreateWebhookDto })
  @ApiWrappedResponse({
    status: 201,
    type: WebhookResponseDto,
    description: 'Webhook created',
  })
  create(@CurrentMerchant() merchantId: string, @Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(merchantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List webhook endpoints' })
  @ApiWrappedResponse({
    status: 200,
    type: WebhookListResponseDto,
    description: 'Paginated webhooks list',
  })
  findAll(@CurrentMerchant() merchantId: string) {
    return this.webhooksService.findAll(merchantId);
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'List webhook delivery logs' })
  @ApiParam({ name: 'id', type: String })
  @ApiWrappedResponse({
    status: 200,
    type: WebhookDeliveryListResponseDto,
    description: 'Paginated webhook delivery logs list',
  })
  findDeliveries(
    @CurrentMerchant() merchantId: string,
    @Param('id') id: string,
  ) {
    return this.webhooksService.findDeliveries(merchantId, id);
  }

  @Post('replay')
  @ApiOperation({
    summary:
      'Re-deliver past events by subscription ID or time range, sourced from the event store',
  })
  @ApiBody({ type: ReplayWebhooksDto })
  @ApiWrappedResponse({
    status: 200,
    type: ReplayWebhooksResponseDto,
    description: 'Number of matching events replayed',
  })
  replay(
    @CurrentMerchant() merchantId: string,
    @Body() dto: ReplayWebhooksDto,
  ) {
    return this.webhooksService.replay(merchantId, dto);
  }
}
