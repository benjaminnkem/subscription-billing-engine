import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPendingSubscriptionStatus1740000000000
  implements MigrationInterface
{
  name = 'AddPendingSubscriptionStatus1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasEnum = await queryRunner.query(
      `SELECT 1 FROM pg_type WHERE typname = 'subscriptions_status_enum'`,
    );
    if (hasEnum.length > 0) {
      await queryRunner.query(
        `ALTER TYPE "subscriptions_status_enum" ADD VALUE IF NOT EXISTS 'pending' BEFORE 'trialing'`,
      );
    }
  }

  public async down(): Promise<void> {
    // PostgreSQL does not support removing enum values without recreating the type.
  }
}