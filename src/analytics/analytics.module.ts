import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { EventStore } from '../events/entities/event-store.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { PaymentAttempt } from '../payments/entities/payment-attempt.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Plan } from '../plans/entities/plan.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { WebhookDelivery } from '../webhooks/entities/webhook-delivery.entity';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Subscription,
      Payment,
      PaymentAttempt,
      Plan,
      Customer,
      Invoice,
      EventStore,
      WebhookDelivery,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
