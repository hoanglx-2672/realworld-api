import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommentIndexes1794300000000 implements MigrationInterface {
  name = 'AddCommentIndexes1794300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_author_id" ON "comments"  ("author_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_article_id" ON "comments"  ("article_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_comments_article_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_comments_author_id"`);
  }
}
