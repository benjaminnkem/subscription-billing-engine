import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { ChaosService } from '../chaos/chaos.service';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { generateCorrelationId } from './correlation.util';
import { DomainEventPayload, DomainEventType } from './domain-events';
import { resolveEventCategory } from './event-categories';
import { EventStore } from './entities/event-store.entity';
import { EventPresentationService } from './mission-control/event-presentation.service';
import { MissionControlGateway } from './mission-control/mission-control.gateway';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(EventStore)
    private eventRepo: Repository<EventStore>,
    @InjectQueue(QUEUE_NAMES.EVENTS) private eventsQueue: Queue,
    private presentationService: EventPresentationService,
    private missionControlGateway: MissionControlGateway,
    private configService: ConfigService,
    @Inject(forwardRef(() => ChaosService))
    private chaosService: ChaosService,
  ) {}

  async emit(
    eventType: DomainEventType,
    payload: DomainEventPayload,
  ): Promise<EventStore> {
    const chaosMeta = await this.chaosService.getEventMetadata(
      payload.merchantId,
    );

    const event = this.eventRepo.create({
      merchantId: payload.merchantId,
      eventType,
      aggregateType: payload.aggregateType,
      aggregateId: payload.aggregateId,
      correlationId: payload.correlationId ?? generateCorrelationId(),
      category: resolveEventCategory(eventType),
      payload: payload.data,
      metadata: {
        source: 'subscription-engine',
        version: '1.0',
        environment: this.configService.get<string>('nodeEnv') ?? 'development',
        ...chaosMeta,
        ...payload.metadata,
      },
      processed: false,
    });
    const saved = await this.eventRepo.save(event);

    const timelineEvent = this.presentationService.toTimelineEvent(saved);
    this.missionControlGateway.broadcastEvent(saved.merchantId, timelineEvent);

    await this.eventsQueue.add(
      'process-event',
      { eventId: saved.id },
      { removeOnComplete: true },
    );

    return saved;
  }

  async markProcessed(eventId: string): Promise<void> {
    await this.eventRepo.update(eventId, {
      processed: true,
      processedAt: new Date(),
    });
  }

  async findUnprocessed(limit = 100): Promise<EventStore[]> {
    return this.eventRepo.find({
      where: { processed: false },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async findForReplay(
    merchantId: string,
    filters: { subscriptionId?: string; from?: string; to?: string },
  ): Promise<EventStore[]> {
    const where: Record<string, unknown> = { merchantId };

    if (filters.subscriptionId) {
      where.aggregateId = filters.subscriptionId;
    }

    if (filters.from && filters.to) {
      where.createdAt = Between(new Date(filters.from), new Date(filters.to));
    } else if (filters.from) {
      where.createdAt = MoreThanOrEqual(new Date(filters.from));
    } else if (filters.to) {
      where.createdAt = LessThanOrEqual(new Date(filters.to));
    }

    return this.eventRepo.find({
      where,
      order: { createdAt: 'ASC' },
    });
  }
}
