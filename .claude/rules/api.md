---
paths:
  - "src/**/*.controller.ts"
  - "src/**/*.service.ts"
  - "src/**/*.mapper.ts"
  - "src/**/dto/**/*.ts"
  - "src/auth/**/*.ts"
  - "src/common/**/*.ts"
  - "src/i18n/**/*.json"
---

# API: hợp đồng RealWorld, validation, i18n, bảo mật

Bảng hợp đồng đầy đủ (mã trạng thái, câu lỗi nguyên văn): `docs/realworld-spec/README.md`.

## Request / response
- Body vào và ra luôn bọc key: `{"user"}`, `{"profile"}`, `{"article"}`, `{"articles": [], "articlesCount": n}`, `{"comment"}`, `{"comments": []}`, `{"tags": []}`.
- DTO bọc dùng `@Wrapped(() => InnerDto)` (đã gồm `IsDefined` + `IsObject` + `ValidateNested` + `Type`).
- Không trả entity thẳng — luôn qua `*.mapper.ts`, chọn từng field.
- Mã: tạo 201, xoá `@HttpCode(204)`, login `@HttpCode(200)`, trùng 409, validation 422, thiếu/sai token 401, không phải chủ 403, không thấy 404.
- Route tĩnh khai báo **trước** route có tham số trong cùng controller (`@Get('feed')` trước `@Get(':slug')`), không thì nó bị bắt nhầm thành `:slug` → 404.

## Lỗi
- Mọi lỗi có dạng `{"errors": {"<field>": ["<câu>"]}}`: dùng `errorsException(status, field, 'ns.key')`, không ném `HttpException` với chuỗi tự do.
- Lỗi unique của Postgres (`23505`) → `uniqueViolationColumn(error)` → 409; đừng để thành 500.
- Lỗi validation đã được `validationExceptionFactory` đổi sang 422; khi field sai kiểu chỉ trả một câu.

## Validation (class-validator)
- Field bắt buộc: `@IsNotEmpty()` → `can't be blank`. Field tuỳ chọn nhưng không được null (PUT email/username/password): `ValidateIf(v !== undefined)`, không dùng `@IsOptional` (nó bỏ qua null).
- Chuỗi người dùng nhập: `@Trim()` cho tên/email; luôn có `@MaxLength`.
- Tag lưu chữ thường: `@TagNames()` cho `tagList`, `@TagName()` cho `?tag=` (ISS-21).
- `image` của user: `@IsUrl` http/https; `null` / `""` = xoá ảnh (ISS-22).
- Ký tự NUL làm Postgres lỗi 22021 → 500: mọi chuỗi đi vào truy vấn — body, **query DTO** và **`:param`** (vd. `:slug`) — phải chặn bằng `@NoNulChar()` (mảng: `{ each: true }`) hoặc kiểm `includes('\u0000')` → 404.
- Số từ query (`@Type(() => Number)` + `@IsInt()`) luôn có `@Min` và `@Max`: `1e20` vẫn là số nguyên với JS nhưng vượt bigint của Postgres.
- Mật khẩu: `@MinLength(8)` + `@IsByteLength(0, 72)` (bcrypt đếm byte).
- Constraint mới → thêm key `validation.<tênConstraint>` vào **cả** `en` và `vi`.

## i18n
- Mọi câu gửi người dùng đi qua key i18n; `en` = **nguyên văn** câu spec (bộ test so khớp chuỗi), `vi` là bản dịch.
- Trong service/guard: `t('ns.key')` từ `@nestjs/i18n` (đã có locale của request, kể cả trong guard).

## Bảo mật
- `Authorization: Token <jwt>` (không phải `Bearer`); endpoint bắt buộc đăng nhập dùng `@UseGuards(JwtAuthGuard)` + `@CurrentAuth()`.
- Endpoint công khai nhưng kết quả phụ thuộc người xem (`following`, `favorited`): `@UseGuards(OptionalJwtAuthGuard)` + `@CurrentAuth() auth?: AuthContext`; khách → `auth` undefined; token hỏng vẫn 401.
- Payload JWT chỉ `{ sub: userId }`; secret từ `JWT_SECRET`. Đổi mật khẩu **không** thu hồi token cũ: bộ test chính thức đòi token cũ vẫn dùng được (`errors_auth.hurl:240–261`, ISS-03).
- Guard kiểm cả user còn tồn tại; header sai dạng (`Bearer x`) → 401 `is invalid`, kể cả ở endpoint tuỳ chọn.
- Login giới hạn theo IP bằng `ThrottlerGuard` (`src/users/login-throttle.ts`, env `LOGIN_THROTTLE_*`) → 429 `{"errors":{"request":[…]}}`; e2e nới lên 1000 trong `vitest.config.e2e.ts` (ISS-20).
- Login sai email hay sai mật khẩu đều trả cùng `401 credentials invalid` (so với hash giả khi không có user).
- Kiểm quyền sở hữu trong service trước khi sửa/xoá.
- Không bao giờ trả `password`/hash; không log token hay mật khẩu.
