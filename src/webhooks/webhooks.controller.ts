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
import { WebhooksService } from './webhooks.service';
import {
  WebhookResponseDto,
  WebhookListResponseDto,
  WebhookDeliveryListResponseDto,
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
}
