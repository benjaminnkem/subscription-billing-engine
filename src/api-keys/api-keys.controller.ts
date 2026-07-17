import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentMerchant } from '../common/decorators/current-merchant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@ApiTags('API Keys')
@ApiBearerAuth()
@Controller('api-keys')
export class ApiKeysController {
  constructor(private apiKeysService: ApiKeysService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiBody({ type: CreateApiKeyDto })
  @ApiResponse({ status: 201 })
  create(
    @CurrentMerchant() merchantId: string,
    @CurrentUser() user: { email: string },
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(merchantId, dto, user.email);
  }

  @Get()
  @ApiOperation({ summary: 'List API keys' })
  @ApiResponse({ status: 200 })
  findAll(@CurrentMerchant() merchantId: string) {
    return this.apiKeysService.findAll(merchantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200 })
  revoke(
    @CurrentMerchant() merchantId: string,
    @CurrentUser() user: { email: string },
    @Param('id') id: string,
  ) {
    return this.apiKeysService.revoke(merchantId, id, user.email);
  }

  @Post(':id/rotate')
  @ApiOperation({ summary: 'Rotate an API key' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200 })
  rotate(
    @CurrentMerchant() merchantId: string,
    @CurrentUser() user: { email: string },
    @Param('id') id: string,
  ) {
    return this.apiKeysService.rotate(merchantId, id, user.email);
  }
}
