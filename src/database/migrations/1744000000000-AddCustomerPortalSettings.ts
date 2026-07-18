import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerPortalSettings1744000000000 implements MigrationInterface {
  name = 'AddCustomerPortalSettings1744000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add customerPortalSettings column to merchants
    await queryRunner.query(
      `ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "customerPortalSettings" jsonb`,
    );

    // Create portal_sessions table
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "portal_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "token" varchar(64) NOT NULL,
        "customerId" uuid NOT NULL,
        "merchantId" uuid NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "usedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_portal_sessions_token" ON "portal_sessions" ("token")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_portal_sessions_customer" ON "portal_sessions" ("customerId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_portal_sessions_customer"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_portal_sessions_token"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_sessions"`);
    await queryRunner.query(
      `ALTER TABLE "merchants" DROP COLUMN IF EXISTS "customerPortalSettings"`,
    );
  }
}
