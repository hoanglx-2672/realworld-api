import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ISS-21: tag lưu dạng chuẩn hoá. Gộp các tag cũ chỉ khác nhau ở hoa/thường hoặc khoảng
 * trắng hai đầu (" NestJS" → "nestjs") vào tag chuẩn:
 * 1. tạo tag chuẩn nếu chưa có;
 * 2. chuyển liên kết bài viết sang tag chuẩn (bỏ qua nếu bài đã gắn sẵn);
 * 3. xoá tag cũ (article_tags còn lại tự xoá theo ON DELETE CASCADE).
 *
 * Chuẩn hoá bằng JS (`trim().toLowerCase()`), **đúng hàm app dùng** khi ghi và khi lọc
 * (`TagName(s)` trong common/validators.ts), không dùng lower() của Postgres: lower() theo
 * locale của DB, có chỗ khác JS (sigma cuối từ "Σ" → "σ" thay vì "ς").
 *
 * Không đảo ngược được: không còn biết tên gốc viết thế nào → down() để trống.
 */
export const normalizeTagName = (name: string) => name.trim().toLowerCase();

export class LowercaseTags1794400000000 implements MigrationInterface {
  name = 'LowercaseTags1794400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: number; name: string }[] = await queryRunner.query(
      `SELECT "id", "name" FROM "tags" ORDER BY "id"`,
    );
    for (const row of rows) {
      const normalized = normalizeTagName(row.name);
      // Đã chuẩn, hoặc toàn khoảng trắng (validation chưa từng cho lưu) → để nguyên.
      if (normalized === row.name || !normalized) continue;

      const [target]: { id: number }[] = await queryRunner.query(
        `INSERT INTO "tags" ("name") VALUES ($1)
         ON CONFLICT ("name") DO UPDATE SET "name" = EXCLUDED."name"
         RETURNING "id"`,
        [normalized],
      );
      await queryRunner.query(
        `INSERT INTO "article_tags" ("article_id", "tag_id")
         SELECT "article_id", $1 FROM "article_tags" WHERE "tag_id" = $2
         ON CONFLICT DO NOTHING`,
        [target.id, row.id],
      );
      await queryRunner.query(`DELETE FROM "tags" WHERE "id" = $1`, [row.id]);
    }
  }

  public async down(): Promise<void> {
    // Cố ý không làm gì: xem chú thích lớp.
  }
}
