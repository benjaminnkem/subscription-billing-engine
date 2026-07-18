import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Plan } from '../plans/entities/plan.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { ChaosScenarioRunner } from './chaos-scenario.runner';
import { ChaosController } from './chaos.controller';
import { ChaosService } from './chaos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, Customer, Plan, Payment])],
  controllers: [ChaosController],
  providers: [ChaosService, ChaosScenarioRunner],
  exports: [ChaosService],
})
export class ChaosModule {}
