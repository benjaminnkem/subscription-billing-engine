import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PortalService } from './portal.service';
import { PortalLoginRequestDto } from './dto/portal-login-request.dto';
import { PortalActionRequestDto } from './dto/portal-action-request.dto';
import { PortalSessionResponseDto } from './dto/portal-session-response.dto';

@ApiTags('Portal')
@Controller('portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Public()
  @Post('login')
  @ApiOperation({
    summary: 'Request a secure magic login link for the customer portal',
  })
  @ApiCreatedResponse({ description: 'Login link has been successfully generated and sent via email.' })
  requestLogin(@Body() dto: PortalLoginRequestDto) {
    return this.portalService.requestLogin(
      dto.email,
      dto.merchantId,
      dto.mode ?? 'live',
    );
  }

  @Public()
  @Get('session')
  @ApiOperation({
    summary: 'Retrieve session state and settings for customer portal',
  })
  @ApiOkResponse({ type: PortalSessionResponseDto })
  getSessionState(@Query('token') token: string) {
    return this.portalService.getSessionState(token);
  }

  @Public()
  @Post('session/action')
  @ApiOperation({
    summary: 'Execute a self-service action inside the customer portal session',
  })
  @ApiCreatedResponse({ type: PortalSessionResponseDto })
  executeAction(
    @Query('token') token: string,
    @Body() dto: PortalActionRequestDto,
  ) {
    return this.portalService.executeAction(token, dto.action, dto.data);
  }
}
