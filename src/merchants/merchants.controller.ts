import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MerchantsService } from './merchants.service';
import { CurrentMerchant } from '../common/decorators/current-merchant.decorator';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { AccountLookupDto } from './dto/account-lookup.dto';

@ApiTags('Merchants')
@ApiBearerAuth()
@Controller('merchants')
export class MerchantsController {
  constructor(private merchantsService: MerchantsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current merchant profile' })
  getProfile(@CurrentMerchant() merchantId: string) {
    return this.merchantsService.findOne(merchantId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update merchant profile' })
  @ApiBody({ type: UpdateMerchantDto })
  update(
    @CurrentMerchant() merchantId: string,
    @Body() dto: UpdateMerchantDto,
  ) {
    return this.merchantsService.update(merchantId, dto);
  }
}
