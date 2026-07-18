import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from 'src/api-keys/entities/api-key.entity';
import { AuditLog } from 'src/audit/entities/audit-log.entity';
import { User } from 'src/auth/entities/user.entity';
import { Customer } from 'src/customers/entities/customer.entity';
import { EventStore } from 'src/events/entities/event-store.entity';
import { InvoiceItem } from 'src/invoices/entities/invoice-item.entity';
import { Invoice } from 'src/invoices/entities/invoice.entity';
import { Merchant } from 'src/merchants/entities/merchant.entity';
import { Notification } from 'src/notifications/entities/notification.entity';
import { MonnifyWebhookEvent } from 'src/payments/entities/monnify-webhook-event.entity';
import { PaymentAttempt } from 'src/payments/entities/payment-attempt.entity';
import { Payment } from 'src/payments/entities/payment.entity';
import { Plan } from 'src/plans/entities/plan.entity';
import { Subscription } from 'src/subscriptions/entities/subscription.entity';
import { WebhookDelivery } from 'src/webhooks/entities/webhook-delivery.entity';
import { Webhook } from 'src/webhooks/entities/webhook.entity';

const entities = [
  User,
  Merchant,
  AuditLog,
  ApiKey,
  Customer,
  Plan,
  Subscription,
  Invoice,
  InvoiceItem,
  Payment,
  PaymentAttempt,
  MonnifyWebhookEvent,
  Notification,
  EventStore,
  Webhook,
  WebhookDelivery,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDevelopment = config.get<string>('nodeEnv') === 'development';

        return {
          type: 'postgres',
          host: config.get<string>('database.host'),
          port: config.get<number>('database.port'),
          username: config.get<string>('database.username'),
          password: config.get<string>('database.password'),
          database: config.get<string>('database.name'),
          entities,
          migrations: [`${__dirname}/migrations/*{.ts,.js}`],
          migrationsRun: isDevelopment,
          synchronize: isDevelopment,
          logging: config.get<string>('data.logging') === 'true',
        };
      },
    }),
  ],
})
export class DatabaseModule {}
