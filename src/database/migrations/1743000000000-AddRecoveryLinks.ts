import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecoveryLinks1743000000000 implements MigrationInterface {
  name = 'AddRecoveryLinks1743000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasEnum = await queryRunner.query(
      `SELECT 1 FROM pg_type WHERE typname = 'recovery_links_action_enum'`,
    );
    if (hasEnum.length === 0) {
      await queryRunner.query(
        `CREATE TYPE "recovery_links_action_enum" AS ENUM ('STATUS', 'RETRY', 'PAUSE', 'CANCEL')`,
      );
    }

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "recovery_links" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "merchantId" uuid NOT NULL,
        "subscriptionId" uuid NOT NULL,
        "action" "recovery_links_action_enum" NOT NULL,
        "token" varchar(64) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "usedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz
      )`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_recovery_links_token" ON "recovery_links" ("token")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_recovery_links_subscription" ON "recovery_links" ("subscriptionId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "recovery_links"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "recovery_links_action_enum"`);
  }
}
