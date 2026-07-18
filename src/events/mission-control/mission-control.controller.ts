import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentMerchant } from '../../common/decorators/current-merchant.decorator';
import { ApiWrappedResponse } from '../../common/dto/api-response.dto';
import { EventsQueryDto } from './dto/events-query.dto';
import {
  TimelineEventDto,
  TimelineEventsResponseDto,
} from './dto/mission-control-response.dto';
import {
  TimelineEvent,
  TimelineEventsResponse,
} from './dto/timeline-event.dto';
import { MissionControlService } from './mission-control.service';

@ApiTags('Mission Control')
@ApiBearerAuth()
@Controller('events')
export class MissionControlController {
  constructor(private missionControlService: MissionControlService) {}

  @Get()
  @ApiOperation({ summary: 'List timeline events for Mission Control' })
  @ApiWrappedResponse({
    status: 200,
    type: TimelineEventsResponseDto,
    description: 'Paginated timeline events',
  })
  listEvents(
    @CurrentMerchant() merchantId: string,
    @Query() query: EventsQueryDto,
  ): Promise<TimelineEventsResponse> {
    return this.missionControlService.findEvents(merchantId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single timeline event' })
  @ApiWrappedResponse({
    status: 200,
    type: TimelineEventDto,
    description: 'Timeline event details',
  })
  getEvent(
    @CurrentMerchant() merchantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TimelineEvent> {
    return this.missionControlService.findOne(merchantId, id);
  }
}
