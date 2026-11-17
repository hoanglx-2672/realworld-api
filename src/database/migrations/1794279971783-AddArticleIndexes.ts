import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArticleIndexes1794279971783 implements MigrationInterface {
  name = 'AddArticleIndexes1794279971783';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_articles_created_at" ON "articles"  ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_articles_author_id" ON "articles"  ("author_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_articles_author_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_articles_created_at"`);
  }
}
