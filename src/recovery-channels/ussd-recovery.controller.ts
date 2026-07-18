import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { RecoveredViaChannel } from '../shared/enums';
import { UssdSessionDto } from './dto/ussd-session.dto';
import { RecoveryAction } from './recovery-action.enum';
import { RecoveryChannelsService } from './recovery-channels.service';

const MENU_TEXT =
  'CON Welcome to Subflow Subscriptions\n1. Check status\n2. Pause subscription\n3. Cancel subscription';

const MENU_OPTION_TO_ACTION: Record<string, RecoveryAction> = {
  '1': RecoveryAction.STATUS,
  '2': RecoveryAction.PAUSE,
  '3': RecoveryAction.CANCEL,
};

@Controller('ussd')
export class UssdRecoveryController {
  constructor(private recoveryChannelsService: RecoveryChannelsService) {}

  @Public()
  @Post('session')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handleSession(
    @Body() dto: UssdSessionDto,
    @Res() res: Response,
  ): Promise<void> {
    const firstHop = dto.text.trim().length === 0;

    if (firstHop) {
      res.type('text/plain').send(MENU_TEXT);
      return;
    }

    const selection = dto.text.split('*')[0];
    const action = MENU_OPTION_TO_ACTION[selection];

    if (!action) {
      res.type('text/plain').send('END Invalid option.');
      return;
    }

    try {
      const result = await this.recoveryChannelsService.handleAction(
        dto.phoneNumber,
        action,
        RecoveredViaChannel.USSD,
      );
      res.type('text/plain').send(`END ${result.replyMessage}`);
    } catch {
      res
        .type('text/plain')
        .send("END We couldn't find a subscription for this number.");
    }
  }
}
