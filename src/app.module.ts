import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { ChaosModule } from './chaos/chaos.module';
import { CommonModule } from './common/common.module';
import { ConfigModule } from './config/config.module';
import { CustomersModule } from './customers/customers.module';
import { DatabaseModule } from './database/database.module';
import { DunningModule } from './dunning/dunning.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { ServiceInfoModule } from './service-info/service-info.module';
import { InvoicesModule } from './invoices/invoices.module';
import { MerchantsModule } from './merchants/merchants.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MonnifyWebhooksModule } from './payments/monnify-webhooks.module';
import { PaymentsModule } from './payments/payments.module';
import { PlansModule } from './plans/plans.module';
import { QueuesModule } from './queues/queues.module';
import { RecoveryChannelsModule } from './recovery-channels/recovery-channels.module';
import { RedisModule } from './redis/redis.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { PortalModule } from './portal/portal.module';

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    DatabaseModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    RedisModule,
    QueuesModule,
    AuthModule,
    MerchantsModule,
    ApiKeysModule,
    PlansModule,
    CustomersModule,
    SubscriptionsModule,
    InvoicesModule,
    PaymentsModule,
    MonnifyWebhooksModule,
    BillingModule,
    ChaosModule,
    DunningModule,
    WebhooksModule,
    NotificationsModule,
    RecoveryChannelsModule,
    AnalyticsModule,
    AuditModule,
    EventsModule,
    HealthModule,
    ServiceInfoModule,
    PortalModule,
  ],
})
export class AppModule {}
