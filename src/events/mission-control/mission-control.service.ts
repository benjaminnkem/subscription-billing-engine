import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventStore } from '../entities/event-store.entity';
import { EventsQueryDto } from './dto/events-query.dto';
import {
  TimelineEvent,
  TimelineEventsResponse,
} from './dto/timeline-event.dto';
import { EventPresentationService } from './event-presentation.service';

@Injectable()
export class MissionControlService {
  constructor(
    @InjectRepository(EventStore)
    private eventRepo: Repository<EventStore>,
    private presentationService: EventPresentationService,
  ) {}

  async findEvents(
    merchantId: string,
    query: EventsQueryDto,
  ): Promise<TimelineEventsResponse> {
    const limit = query.limit ?? 100;

    const qb = this.eventRepo
      .createQueryBuilder('e')
      .where('e.merchantId = :merchantId', { merchantId })
      .orderBy('e.createdAt', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .take(limit + 1);

    if (query.cursor) {
      const cursorEvent = await this.eventRepo.findOne({
        where: { id: query.cursor, merchantId },
      });
      if (!cursorEvent) {
        throw new NotFoundException('Cursor event not found');
      }
      qb.andWhere(
        '(e.createdAt < :cursorAt OR (e.createdAt = :cursorAt AND e.id < :cursorId))',
        {
          cursorAt: cursorEvent.createdAt,
          cursorId: cursorEvent.id,
        },
      );
    }

    if (query.aggregateId) {
      qb.andWhere('e.aggregateId = :aggregateId', {
        aggregateId: query.aggregateId,
      });
    }

    if (query.correlationId) {
      qb.andWhere('e.correlationId = :correlationId', {
        correlationId: query.correlationId,
      });
    }

    if (query.type) {
      qb.andWhere('e.eventType = :type', { type: query.type });
    }

    if (query.category) {
      qb.andWhere('e.category = :category', { category: query.category });
    }

    const events = await qb.getMany();
    const hasMore = events.length > limit;
    const page = hasMore ? events.slice(0, limit) : events;

    return {
      data: page.map((event) =>
        this.presentationService.toTimelineEvent(event),
      ),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  async findOne(merchantId: string, eventId: string): Promise<TimelineEvent> {
    const event = await this.eventRepo.findOne({
      where: { id: eventId, merchantId },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return this.presentationService.toTimelineEvent(event);
  }
}
