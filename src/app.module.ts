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
import { CustomersModule } from './customers/customers.module';
import { PlansModule } from './plans/plans.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { MonnifyWebhooksModule } from './payments/monnify-webhooks.module';
import { BillingModule } from './billing/billing.module';
import { DunningModule } from './dunning/dunning.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { MailModule } from './mail/mail.module';

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
    MailModule,

    HealthModule,
    AuthModule,
    MerchantsModule,
    ApiKeysModule,
    AuditModule,
    NotificationsModule,
    EventsModule,

    // Billing domain
    CustomersModule,
    PlansModule,
    SubscriptionsModule,
    InvoicesModule,
    PaymentsModule,
    MonnifyWebhooksModule,
    BillingModule,
    DunningModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
