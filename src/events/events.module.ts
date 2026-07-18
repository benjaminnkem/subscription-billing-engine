import { Module, forwardRef } from '@nestjs/common';
import { ChaosModule } from '../chaos/chaos.module';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { EventStore } from './entities/event-store.entity';
import { EventsProcessor } from './events.processor';
import { EventsService } from './events.service';
import { EventPresentationService } from './mission-control/event-presentation.service';
import { MissionControlController } from './mission-control/mission-control.controller';
import { MissionControlGateway } from './mission-control/mission-control.gateway';
import { MissionControlService } from './mission-control/mission-control.service';

@Module({
  imports: [
    forwardRef(() => ChaosModule),
    TypeOrmModule.forFeature([EventStore]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
      }),
    }),
    forwardRef(() => WebhooksModule),
    forwardRef(() => AnalyticsModule),
    forwardRef(() => NotificationsModule),
    AuditModule,
  ],
  controllers: [MissionControlController],
  providers: [
    EventsService,
    EventsProcessor,
    EventPresentationService,
    MissionControlService,
    MissionControlGateway,
  ],
  exports: [EventsService, EventPresentationService],
})
export class EventsModule {}
