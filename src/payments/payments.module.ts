import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersModule } from '../customers/customers.module';
import { EventsModule } from '../events/events.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { PaymentAttempt } from './entities/payment-attempt.entity';
import { Payment } from './entities/payment.entity';
import { MonnifyService } from './monnify.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentAttempt]),
    CustomersModule,
    EventsModule,
    InvoicesModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, MonnifyService],
  exports: [PaymentsService, MonnifyService],
})
export class PaymentsModule {}
