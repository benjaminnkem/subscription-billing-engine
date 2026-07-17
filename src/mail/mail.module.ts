import { MailerModule } from '@nestjs-modules/mailer';
import { EjsAdapter } from '@nestjs-modules/mailer/adapters/ejs.adapter';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { EmailTemplateRegistry } from './email-template.registry';
import { MailService } from './mail.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('mail.host'),
          port: config.get<number>('mail.port'),
          secure: config.get<boolean>('mail.secure'),
          auth: config.get<string>('mail.user')
            ? {
                user: config.get<string>('mail.user'),
                pass: config.get<string>('mail.password'),
              }
            : undefined,
          family: 4,
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
          logger: true,
        },
        defaults: {
          from: `"${config.get<string>('mail.fromName')}" <${config.get<string>('mail.fromAddress')}>`,
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new EjsAdapter(),
          options: {
            strict: false,
          },
        },
      }),
    }),
  ],
  providers: [MailService, EmailTemplateRegistry],
  exports: [MailService, EmailTemplateRegistry],
})
export class MailModule {}
