import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { MonnifyWebhooksService } from './monnify-webhooks.service';
import type { MonnifyWebhookPayload } from './monnify-webhook.types';

@ApiTags('Monnify Webhooks')
@Controller('webhooks/monnify')
export class MonnifyWebhooksController {
  constructor(private monnifyWebhooksService: MonnifyWebhooksService) {}

  @Public()
  @Post()
  @HttpCode(200)
  @ResponseMessage('Webhook received')
  @UsePipes(
    new ValidationPipe({
      whitelist: false,
      forbidNonWhitelisted: false,
      transform: false,
    }),
  )
  @ApiOperation({ summary: 'Receive payment events from Monnify' })
  @ApiResponse({ status: 200, description: 'Webhook accepted' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  handleWebhook(
    @Body() payload: MonnifyWebhookPayload,
    @Req() req: RawBodyRequest<Request>,
    @Headers('monnify-signature') signature?: string,
  ) {
    const rawBody = req.rawBody?.toString('utf8');

    return this.monnifyWebhooksService.process(payload, {
      signature,
      rawBody,
    });
  }
}
