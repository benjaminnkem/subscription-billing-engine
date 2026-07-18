import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventObservability1741000000000 implements MigrationInterface {
  name = 'AddEventObservability1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasEventStore = await queryRunner.hasTable('event_store');
    if (hasEventStore) {
      await queryRunner.query(
        `ALTER TABLE "event_store" ADD COLUMN IF NOT EXISTS "correlationId" varchar(64)`,
      );
      await queryRunner.query(
        `ALTER TABLE "event_store" ADD COLUMN IF NOT EXISTS "category" varchar(50)`,
      );
      await queryRunner.query(
        `ALTER TABLE "event_store" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_event_store_correlation" ON "event_store" ("merchantId", "correlationId")`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_event_store_created" ON "event_store" ("merchantId", "createdAt" DESC)`,
      );
    }

    const hasSubscriptions = await queryRunner.hasTable('subscriptions');
    if (hasSubscriptions) {
      await queryRunner.query(
        `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "correlationId" varchar(64)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_event_store_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_event_store_correlation"`);
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "correlationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_store" DROP COLUMN IF EXISTS "metadata"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_store" DROP COLUMN IF EXISTS "category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_store" DROP COLUMN IF EXISTS "correlationId"`,
    );
  }
}