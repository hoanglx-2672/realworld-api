---
name: implement-feature
description: Bước 2/4 của vòng làm một feature RealWorld (research → implement → review → qa). Code MỘT PR của feature theo docs/features/<feature>/research.md, test-first: viết e2e test từ case nghiệm thu (RED) rồi mới code module/DTO/service/controller, i18n, migration cho tới GREEN. Dùng khi user nói "implement X", "code feature X", "làm PR tiếp theo", "làm endpoint đăng ký/login/articles…", "bắt đầu code auth".
argument-hint: "<feature> [số PR, mặc định PR chưa xong đầu tiên]"
---

# Implement feature

## Điều kiện vào
- Có `docs/features/<feature>/research.md` và không còn câu hỏi mở. Chưa có thì chạy skill `research-feature` trước, đừng tự đoán spec.
- Postgres đang chạy (`npm run db:up`), migration đã chạy hết (`npm run migration:show` không còn `[ ]`).
- Đọc `CLAUDE.md` (quy ước) và bảng hợp đồng `docs/realworld-spec/README.md`.

Mỗi lần chạy skill = **một PR** trong bảng "Chia PR" của research.md. Không làm lấn sang PR sau.

## Quy trình

### 1. RED: viết test trước
- File `test/<feature>.e2e-spec.ts`. Dựng app **giống `main.ts`**: `setGlobalPrefix('api')`, cùng pipe, cùng filter, cùng `AppModule`, DB thật. Tách hàm `createTestApp()` dùng chung ở `test/support/` khi đã có từ hai file trở lên.
- Mỗi case nghiệm thu của PR này thành một `it('AUTH-03 …')`, kèm cả case lỗi (401/403/404/409/422), không chỉ đường thành công.
- Dữ liệu duy nhất mỗi lần chạy: hậu tố `uid = Date.now()` cho username/email/title, như bộ Hurl, để chạy lại không đụng dữ liệu cũ, không cần xoá DB.
- Chạy `npx vitest run --config ./vitest.config.e2e.ts test/<feature>.e2e-spec.ts` và **xác nhận nó fail đúng lý do** (404 vì chưa có route, không phải lỗi cú pháp).

### 2. GREEN: code
Cấu trúc một feature:
```
src/<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts     # chỉ nhận request, gọi service, bọc key response
├── <feature>.service.ts        # nghiệp vụ, kiểm quyền sở hữu, ném exception
├── dto/                        # class-validator; body bọc key → DTO lồng + @ValidateNested + @Type
└── <feature>.mapper.ts         # entity → JSON đúng api-response-format (không trả entity thẳng)
```
- Thêm module vào `app.module.ts`; entity mới vào `entities` trong `src/database/typeorm.options.ts`.
- **Đổi schema**: sửa entity → `npm run migration:generate -- src/database/migrations/<TenPascalCase>` → **đọc** `up()`/`down()` → `migration:run` → `migration:revert` → `migration:run`. Không bao giờ `synchronize`, không sửa migration đã merge.
- **i18n**: mọi câu gửi người dùng qua key. `en` = **nguyên văn spec** (`can't be blank`, `not found`…), thêm bản `vi`. Trong exception dùng `t('ns.key')` từ `@nestjs/i18n`.
- **Mã trạng thái**: POST tạo mới 201 (mặc định của Nest), DELETE 204 (`@HttpCode(204)`), login 200 (`@HttpCode(200)`, vì Nest mặc định POST = 201).
- **Bảo mật**: bcrypt cho mật khẩu; không trả `password`; JWT secret từ `.env` (thêm vào `.env.example`); kiểm chủ sở hữu ở service.
- **Truy vấn**: tránh N+1 khi tính `following`/`favorited`/`favoritesCount` cho danh sách (join hoặc truy vấn gộp); `articlesCount` đếm theo cùng bộ lọc, không theo trang.
- Thư viện mới: kiểm `node_modules/<gói>/dist/*.d.ts` trước khi dùng; ghi lý do trong research.md nếu chưa có.

Chạy test hẹp nhất sau mỗi thay đổi cho tới khi xanh. **Không sửa test cho qua.** Nếu test sai so với spec thì sửa test và ghi lý do vào research.md.

### 3. Kiểm cuối
```bash
npm run format
node .claude/skills/review-feature/scripts/kiem.mjs --nhanh   # lint, typecheck, unit
npm run test:e2e
```
Feature đã đủ endpoint cho file Hurl thì chạy thêm `node .claude/skills/qa-test-feature/scripts/chay-hurl.mjs <feature>` để soát sớm (QA đầy đủ là bước 4).

### 4. Cập nhật & bàn giao
- Trong research.md: đánh dấu PR này xong, ghi lệch so với kế hoạch (nếu có).
- Báo user: file đã tạo/sửa, case nào xanh, migration mới (nếu có), số dòng thay đổi.
- Bước tiếp theo là `review-feature`. Không tự commit / push. Chỉ làm khi user bảo.

## Bẫy đã biết
- ESM: import tương đối có đuôi `.js`; hai entity import lẫn nhau → `Relation<T>`.
- `password` có `select: false`: login phải `addSelect('user.password')`.
- Lỗi validation của DTO lồng (`user.email`) phải ra key `email` (filter bỏ tiền tố).
- `bio`/`image`: `""` → lưu `null`.
- `tagList` khi update: không gửi = giữ, `[]` = xoá hết, `null` = 422.
- Hai bài trùng title vẫn phải có slug khác nhau (thêm hậu tố ngắn).
