---
paths:
  - "src/**/*.entity.ts"
  - "src/database/**/*.ts"
  - "docker-compose.yml"
---

# Database: entity và migration

- Không bao giờ `synchronize: true` (cổng `kiem.mjs` sẽ FAIL).
- Đổi schema: sửa entity → `npm run migration:generate -- src/database/migrations/<TenPascalCase>` → đọc `up()` và `down()` → `npm run migration:run` → `npm run migration:revert` → `npm run migration:run` → commit entity + migration trong cùng PR.
- Không sửa/xoá migration đã merge; cần đổi thì tạo migration mới.
- `generate` sinh DROP + ADD khi đổi tên cột → sửa tay thành `RENAME COLUMN`.
- Kiểm entity khớp DB: `generate` phải báo "No changes in database schema".
- Entity mới: kế thừa `BaseEntity` (`id`, `created_at`, `updated_at`; trừ bảng tra cứu như `tags`) và thêm vào mảng `entities` trong `src/database/typeorm.options.ts`.
- Cột DB snake_case khai báo rõ (`@JoinColumn({ name: 'author_id' })`), thuộc tính TS camelCase.
- Hai entity import lẫn nhau → bọc kiểu quan hệ bằng `Relation<T>`.
- Field spec cho phép null (như `bio`, `image`) → `nullable: true`, không dùng default `''`.
- `users.password` có `select: false`: đọc khi cần bằng `addSelect('user.password')`.
- Ghi nhiều bảng trong một thao tác (article + tags) → `manager.transaction(...)`; đọc-rồi-ghi một dòng có thể bị xoá song song → khoá `setLock('pessimistic_write')` bằng câu không JOIN.
- Danh sách: tránh N+1 khi tính `following` / `favorited` / `favoritesCount`.
