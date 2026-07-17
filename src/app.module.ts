import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { MerchantsModule } from './merchants/merchants.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { AuditModule } from './audit/audit.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { QueuesModule } from './queues/queues.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    CommonModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    RedisModule,
    QueuesModule,
    ScheduleModule.forRoot(),

    HealthModule,
    AuthModule,
    MerchantsModule,
    ApiKeysModule,
    AuditModule,
    NotificationsModule,
    EventsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
