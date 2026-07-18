import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { RecoveredViaChannel } from '../shared/enums';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { RecoveryChannelsService } from './recovery-channels.service';
import { RecoveryLinkService } from './recovery-link.service';

@Controller('recovery/email')
export class EmailRecoveryController {
  constructor(
    private recoveryLinkService: RecoveryLinkService,
    private subscriptionsService: SubscriptionsService,
    private recoveryChannelsService: RecoveryChannelsService,
  ) {}

  @Public()
  @Get()
  @ApiExcludeEndpoint()
  async handle(
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!token) {
      throw new BadRequestException('Missing token');
    }

    try {
      const { merchantId, subscriptionId, action } =
        await this.recoveryLinkService.redeem(token);

      const subscription = await this.subscriptionsService.findOne(
        merchantId,
        subscriptionId,
      );

      const result = await this.recoveryChannelsService.executeAction(
        subscription,
        action,
        RecoveredViaChannel.EMAIL,
      );

      res.type('text/html').send(this.renderPage(result.replyMessage));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong.';
      res.status(400).type('text/html').send(this.renderPage(message));
    }
  }

  private renderPage(message: string): string {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Subscription update</title>
    <style>
      body { font-family: -apple-system, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 24px; color: #1a1a1a; }
      p { line-height: 1.5; }
    </style>
  </head>
  <body>
    <p>${message}</p>
  </body>
</html>`;
  }
}
