import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ISS-21: tag lưu chữ thường. Gộp các tag cũ khác nhau chỉ ở hoa/thường ("NestJS" → "nestjs"):
 * 1. tạo tag chữ thường nếu chưa có;
 * 2. chuyển liên kết bài viết sang tag chữ thường (bỏ qua nếu bài đã gắn sẵn);
 * 3. xoá tag hoa (article_tags còn lại tự xoá theo ON DELETE CASCADE).
 * Không đảo ngược được: không còn biết tên gốc viết hoa thế nào → down() để trống.
 */
export class LowercaseTags1794400000000 implements MigrationInterface {
  name = 'LowercaseTags1794400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "tags" ("name") SELECT DISTINCT lower("name") FROM "tags" WHERE "name" <> lower("name") ON CONFLICT ("name") DO NOTHING`,
    );
    await queryRunner.query(
      `INSERT INTO "article_tags" ("article_id", "tag_id")
       SELECT at."article_id", lower_tag."id"
       FROM "article_tags" at
       JOIN "tags" t ON t."id" = at."tag_id"
       JOIN "tags" lower_tag ON lower_tag."name" = lower(t."name")
       WHERE t."name" <> lower(t."name")
       ON CONFLICT DO NOTHING`,
    );
    await queryRunner.query(`DELETE FROM "tags" WHERE "name" <> lower("name")`);
  }

  public async down(): Promise<void> {
    // Cố ý không làm gì: xem chú thích lớp.
  }
}
