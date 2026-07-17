import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { EventStore } from './entities/event-store.entity';
import { EventsProcessor } from './events.processor';
import { EventsService } from './events.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventStore]),
    forwardRef(() => WebhooksModule),
    forwardRef(() => NotificationsModule),
    AuditModule,
  ],
  providers: [EventsService, EventsProcessor],
  exports: [EventsService],
})
export class EventsModule {}
