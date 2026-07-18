import { Module, forwardRef } from '@nestjs/common';
import { ChaosModule } from '../chaos/chaos.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../events/events.module';
import { BillingModule } from '../billing/billing.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { PaymentsModule } from '../payments/payments.module';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { DunningProcessor } from './dunning.processor';
import { DunningService } from './dunning.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription]),
    forwardRef(() => ChaosModule),
    EventsModule,
    forwardRef(() => BillingModule),
    SubscriptionsModule,
    InvoicesModule,
    PaymentsModule,
  ],
  providers: [DunningService, DunningProcessor],
  exports: [DunningService],
})
export class DunningModule {}
