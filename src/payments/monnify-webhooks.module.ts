import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingModule } from '../billing/billing.module';
import { CustomersModule } from '../customers/customers.module';
import { DunningModule } from '../dunning/dunning.module';
import { EventsModule } from '../events/events.module';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoicesModule } from '../invoices/invoices.module';
import { Plan } from '../plans/entities/plan.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { MonnifyWebhookEvent } from './entities/monnify-webhook-event.entity';
import { PaymentAttempt } from './entities/payment-attempt.entity';
import { Payment } from './entities/payment.entity';
import { MonnifyService } from './monnify.service';
import { MonnifyWebhooksController } from './monnify-webhooks.controller';
import { MonnifyWebhooksService } from './monnify-webhooks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MonnifyWebhookEvent,
      Payment,
      PaymentAttempt,
      Invoice,
      Subscription,
      Plan,
    ]),
    CustomersModule,
    InvoicesModule,
    SubscriptionsModule,
    BillingModule,
    DunningModule,
    EventsModule,
  ],
  controllers: [MonnifyWebhooksController],
  providers: [MonnifyWebhooksService, MonnifyService],
})
export class MonnifyWebhooksModule {}
