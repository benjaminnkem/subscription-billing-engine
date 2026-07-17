import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly config: ConfigService,
  ) {}

  async sendTemplate(
    to: string,
    template: string,
    context: Record<string, unknown>,
    subject: string,
  ): Promise<void> {
    try {
      if (!this.config.get<boolean>('mail.enabled')) {
        this.logger.log(
          `[MAIL DISABLED] To: ${to} | Template: ${template} | Subject: ${subject}`,
        );
        return;
      }

      await this.mailerService.sendMail({
        to,
        subject,
        template,
        context: {
          appName: this.config.get<string>('appName'),
          ...context,
        },
      });

      this.logger.log(`Email sent to ${to} (${template})`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
    }
  }

  async sendRaw(to: string, subject: string, html: string): Promise<void> {
    try {
      if (!this.config.get<boolean>('mail.enabled')) {
        this.logger.log(`[MAIL DISABLED] To: ${to} | Subject: ${subject}`);
        return;
      }

      await this.mailerService.sendMail({ to, subject, html });
      this.logger.log(`Email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
    }
  }
}
