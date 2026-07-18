import { Controller, Get, Param, Query } from '@nestjs/common';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiWrappedResponse } from '../common/dto/api-response.dto';
import { CurrentMerchant } from '../common/decorators/current-merchant.decorator';
import { InvoicesService } from './invoices.service';
import {
  InvoiceListResponseDto,
  InvoiceResponseDto,
} from './dto/invoice-response.dto';

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'List invoices' })
  @ApiWrappedResponse({
    status: 200,
    type: InvoiceListResponseDto,
    description: 'Paginated invoices list',
  })
  findAll(
    @CurrentMerchant() merchantId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.invoicesService.findAll(merchantId, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiWrappedResponse({
    status: 200,
    type: InvoiceResponseDto,
    description: 'Invoice record',
  })
  findOne(@CurrentMerchant() merchantId: string, @Param('id') id: string) {
    return this.invoicesService.findOne(merchantId, id);
  }
}
