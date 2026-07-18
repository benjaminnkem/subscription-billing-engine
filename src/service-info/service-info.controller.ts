import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { extractRequestMetadata } from '../common/utils/request-metadata.util';
import { ServiceInfoService } from './service-info.service';

@ApiTags('Service Info')
@Controller('service-info')
export class ServiceInfoController {
  constructor(private serviceInfoService: ServiceInfoService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get service and webhook endpoint information' })
  @ApiResponse({ status: 200 })
  getInfo(@Req() request: Request) {
    return this.serviceInfoService.getServiceInfo(request);
  }

  @Get('requests')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List captured incoming webhook request logs' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiResponse({ status: 200 })
  listRequests(
    @Query() pagination: PaginationDto,
    @Query('category') category?: string,
  ) {
    return this.serviceInfoService.findRequestLogs(
      pagination.page,
      pagination.limit,
      category,
    );
  }

  @Public()
  @Post('echo')
  @HttpCode(200)
  @ResponseMessage('Echo request metadata')
  @ApiOperation({
    summary: 'Echo request metadata for webhook connectivity testing',
  })
  @ApiResponse({ status: 200 })
  async echo(@Req() request: Request) {
    const metadata = extractRequestMetadata(request);

    await this.serviceInfoService.logIncomingRequest({
      ...metadata,
      category: 'test-echo',
      statusCode: 200,
    });

    return metadata;
  }
}