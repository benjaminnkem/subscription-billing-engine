import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { MailModule } from '../mail/mail.module';
import { Notification } from './entities/notification.entity';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';
import { RecoveryMessageBuilder } from './recovery-message.builder';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, Customer]), MailModule],
  providers: [
    NotificationsService,
    NotificationsProcessor,
    RecoveryMessageBuilder,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
