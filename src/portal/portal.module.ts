import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortalSession } from './entities/portal-session.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Plan } from '../plans/entities/plan.entity';
import { Merchant } from '../merchants/entities/merchant.entity';
import { Payment } from '../payments/entities/payment.entity';
import { MailModule } from '../mail/mail.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PortalSession,
      Customer,
      Subscription,
      Invoice,
      Plan,
      Merchant,
      Payment,
    ]),
    MailModule,
    SubscriptionsModule,
  ],
  controllers: [PortalController],
  providers: [PortalService],
  exports: [PortalService],
})
export class PortalModule {}
