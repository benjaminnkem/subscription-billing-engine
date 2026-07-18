import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWhatsappNotificationChannel1742000000000 implements MigrationInterface {
  name = 'AddWhatsappNotificationChannel1742000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasEnum = await queryRunner.query(
      `SELECT 1 FROM pg_type WHERE typname = 'notifications_channel_enum'`,
    );
    if (hasEnum.length > 0) {
      await queryRunner.query(
        `ALTER TYPE "notifications_channel_enum" ADD VALUE IF NOT EXISTS 'whatsapp'`,
      );
    }
  }

  public async down(): Promise<void> {
    // PostgreSQL does not support removing enum values without recreating the type.
  }
}
