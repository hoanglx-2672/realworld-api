# auth — review PR auth-1 + auth-2
Ngày: 2026-11-09 · Base: (chưa có git) · Phạm vi: toàn bộ file mới của auth (~1.300 dòng gồm test — khi lên git cần tách đúng 2 PR như research.md)

## Cổng máy (`kiem.mjs`)
```
SKIP  Git — chưa phải git repo
PASS  Không có synchronize: true
PASS  Lint (oxlint) · Typecheck · Unit test · E2E test (42/42)
PASS  Migration khớp entity — "No changes in database schema"
PASS  Sunlint — error=0 warning=20 điểm=60.9
```

## Đúng spec
Không có vi phạm. Review độc lập (subagent chỉ được xem code + `docs/realworld-spec/`) đã lần từng request trong `auth.hurl`, `errors_auth.hurl` qua DTO → guard → controller → service: mã, hình dạng body, câu lỗi đều khớp.

## Phát hiện
Mỗi phát hiện đã được **xác minh bằng request thật** (`test/auth-hardening.e2e-spec.ts`, fail trước khi sửa).

| # | Hạng | File:dòng | Vấn đề (request → kết quả) | Đề xuất | Trạng thái |
|---|---|---|---|---|---|
| R-01 | Quan trọng | `dto/*.dto.ts` lớp bọc `user` | `{"user": []}` → **500**; `{"user": "abc"}` → câu lỗi tiếng Anh chưa dịch; PUT `{"user": []}` → 200 | `@IsObject()` + key i18n `isObject`, `nestedValidation` | ✅ Đã sửa |
| R-02 | Quan trọng (bảo mật) | `users.service.ts` `update` | Đổi mật khẩu không làm token cũ mất hiệu lực (token bị lộ dùng tiếp tới 7 ngày) | Cột `token_version` trong payload, tăng khi đổi mật khẩu | **Để PR riêng** (cần migration; spec không đòi) |
| R-03 | Quan trọng | `register-user.dto.ts`, `update-user.dto.ts` | username `"   "` → 201; khoảng trắng đầu/cuối được lưu nguyên | Cắt khoảng trắng (`@Transform`) cho username, email | ✅ Đã sửa |
| R-04 | Gợi ý | `register-user.dto.ts` | `MaxLength(72)` đếm ký tự, bcrypt đếm byte: 40 × `é` (80 byte) → 201, phần sau bị cắt âm thầm | `@IsByteLength(0, 72)` | ✅ Đã sửa |
| R-05 | Gợi ý | DTO các field chuỗi | Ký tự NUL (`\u0000`) trong bio/username → **500** (Postgres 22021) | `@Matches(/^[^\u0000]*$/)` | ✅ Đã sửa |
| R-06 | Gợi ý | `update-user.dto.ts` `image` | Nhận mọi chuỗi, kể cả `javascript:alert(1)` | `@IsUrl` http/https khi chuỗi không rỗng | Để sau (client phải tự escape; spec không đòi) |
| R-07 | Quan trọng | `auth.module.ts:13` | `JWT_EXPIRES_IN=3600` bị hiểu là 3600 **ms** → token sống 3 giây (đã đo) | Chuỗi toàn số → `Number(...)` (giây) | ✅ Đã sửa |

### Sunlint — 20 warning (không chặn)
| Rule | Ở đâu | Đánh giá |
|---|---|---|
| S045 brute-force | `POST /users/login` | **Đúng** — đề xuất `@nestjs/throttler` ở PR riêng (cùng R-02) |
| S037 anti-cache | các handler trả token | Đúng một phần — response chứa token nên có `Cache-Control: no-store`; làm cùng PR bảo mật |
| S006 password plaintext | `dto/*.dto.ts` | Báo nhầm: đó là DTO **đầu vào**, response đi qua `toUserResponse` (không có password) |
| S042 JWT không expiresIn | `users.service.ts` `signAsync` | Báo nhầm: `expiresIn` đặt chung ở `JwtModule.registerAsync` |
| C018 / C030 | `saveOrConflict` `throw error` | Cố ý: lỗi không phải unique thì ném lại cho Nest (500 + log) |
| C029 empty catch | `data-source.ts` | Cố ý: thiếu `.env` thì dùng biến môi trường, đã có chú thích |
| S055 Content-Type | controller | Nest/body-parser chỉ đọc JSON; để sau |

## Kết luận
Không có lỗi sai spec. R-01, R-03, R-04, R-05, R-07 sửa ngay trong auth-2. R-02 + S045 + S037 gom thành **PR auth-3 (bảo mật)** — cần user đồng ý vì vượt phạm vi spec.
