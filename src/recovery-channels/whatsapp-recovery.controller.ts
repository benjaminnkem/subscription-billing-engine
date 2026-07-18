import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { RecoveredViaChannel } from '../shared/enums';
import { WhatsappInboundDto } from './dto/whatsapp-inbound.dto';
import { RecoveryChannelsService } from './recovery-channels.service';
@ApiTags('Recovery Channels')
@Controller('webhooks/whatsapp')
export class WhatsappRecoveryController {
  constructor(private recoveryChannelsService: RecoveryChannelsService) {}

  @Public()
  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Receive a WhatsApp recovery button tap (Retry Now / Pause / Cancel)',
  })
  @ApiResponse({ status: 200, description: 'Action processed' })
  handleInbound(@Body() dto: WhatsappInboundDto) {
    return this.recoveryChannelsService.handleAction(
      dto.from,
      dto.action,
      RecoveredViaChannel.WHATSAPP,
    );
  }
}
