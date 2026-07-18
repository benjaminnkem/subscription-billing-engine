import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingModule } from '../billing/billing.module';
import { Customer } from '../customers/entities/customer.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { EmailRecoveryController } from './email-recovery.controller';
import { RecoveryChannelsService } from './recovery-channels.service';
import { RecoveryLinkModule } from './recovery-link.module';
import { UssdRecoveryController } from './ussd-recovery.controller';
import { WhatsappRecoveryController } from './whatsapp-recovery.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, Subscription]),
    SubscriptionsModule,
    BillingModule,
    RecoveryLinkModule,
  ],
  controllers: [
    WhatsappRecoveryController,
    UssdRecoveryController,
    EmailRecoveryController,
  ],
  providers: [RecoveryChannelsService],
})
export class RecoveryChannelsModule {}
