# auth — research
Ngày: 2026-11-09 · Spec: docs/realworld-spec @ 2558884 · Phụ thuộc: không (feature đầu tiên)

Spec chức năng: *"Authenticate users via JWT (login/signup pages + logout button on settings page)"* + *"CRU- users (sign up & settings page)"*.

## Endpoint
| # | Method | Path | Auth | Body vào | Trả về | Mã |
|---|---|---|---|---|---|---|
| 1 | POST | `/api/users` | không | `{"user": {username, email, password}}` | `{"user": User}` | 201 |
| 2 | POST | `/api/users/login` | không | `{"user": {email, password}}` | `{"user": User}` | **200** |
| 3 | GET | `/api/user` | bắt buộc | — | `{"user": User}` | 200 |
| 4 | PUT | `/api/user` | bắt buộc | `{"user": {email?, username?, password?, bio?, image?}}` | `{"user": User}` | 200 |

`User` = `{ email, token, username, bio, image }` — `bio`, `image` là `null` khi chưa có.

**Logout:** spec không có endpoint logout. JWT là stateless → "logout button" là việc của frontend (xoá token phía client). Backend không làm gì; ghi trong README.

## Case nghiệm thu (từ Hurl)
| ID | File:dòng | Mô tả | Mã | Assert chính |
|---|---|---|---|---|
| AUTH-01 | auth.hurl:1 | Đăng ký | 201 | username/email đúng, bio = image = null, token chuỗi không rỗng |
| AUTH-02 | auth.hurl:21 | Đăng nhập | 200 | như trên |
| AUTH-03 | auth.hurl:40 | GET /user có token | 200 | như trên |
| AUTH-04 | auth.hurl:52,69 | PUT bio → lưu được | 200 | bio = "Updated bio" |
| AUTH-05 | auth.hurl:81,93 | PUT bio `""` → `null` | 200 | bio = null, GET lại vẫn null |
| AUTH-06 | auth.hurl:112,124 | PUT bio `null` | 200 | bio = null |
| AUTH-07 | auth.hurl:148,160 | PUT image | 200 | image = URL |
| AUTH-08 | auth.hurl:167,179 | PUT image `""` → `null` | 200 | |
| AUTH-09 | auth.hurl:186–214 | PUT image `null` | 200 | |
| AUTH-10 | auth.hurl:216,236 | PUT đổi username + email, token mới dùng được | 200 | |
| AUTH-E01 | errors_auth.hurl:1 | Đăng ký username `""` | 422 | `errors.username[0]` = `can't be blank` |
| AUTH-E02 | errors_auth.hurl:14 | Đăng ký email `""` | 422 | `errors.email[0]` = `can't be blank` |
| AUTH-E03 | errors_auth.hurl:27 | Đăng ký password `""` | 422 | `errors.password[0]` = `can't be blank` |
| AUTH-E04 | errors_auth.hurl:40 | Đăng ký email sai định dạng | 422 | `errors.email[0]` = `is invalid` |
| AUTH-E05 | errors_auth.hurl:66 | Đăng ký trùng username | **409** | `errors.username[0]` = `has already been taken` |
| AUTH-E06 | errors_auth.hurl:79 | Đăng ký trùng email | **409** | `errors.email[0]` = `has already been taken` |
| AUTH-E07 | errors_auth.hurl:92 | Login email `""` | 422 | `can't be blank` |
| AUTH-E08 | errors_auth.hurl:104 | Login password `""` | 422 | `can't be blank` |
| AUTH-E09 | errors_auth.hurl:116 | Login email `x@` | 422 | `is invalid` |
| AUTH-E10 | errors_auth.hurl:128 | Login sai mật khẩu | 401 | `errors.credentials[0]` = `invalid` |
| AUTH-E11 | errors_auth.hurl:140 | GET /user không token | 401 | `errors.token[0]` = `is missing` |
| AUTH-E12 | errors_auth.hurl:146 | PUT /user không token | 401 | `errors.token[0]` = `is missing` |
| AUTH-E13 | errors_auth.hurl:157,179 | PUT email/username `""` | 422 | |
| AUTH-E14 | errors_auth.hurl:167 | PUT email sai định dạng | 422 | `is invalid` |
| AUTH-E15 | errors_auth.hurl:189,199 | PUT email/username `null` | 422 | (khác bio/image: không nhận null) |
| AUTH-E16 | errors_auth.hurl:213,223 | PUT password `""` / `null` | 422 | |
| AUTH-E17 | errors_auth.hurl:233 | PUT password 7 ký tự | 422 | NIST 800-63B: tối thiểu 8 |
| AUTH-E18 | errors_auth.hurl:243,253 | PUT password 8 ký tự / 64 ký tự | 200 | phải nhận tới ít nhất 64 |

## Case thêm (ngoài bộ test)
| ID | Mô tả | Mong đợi |
|---|---|---|
| AUTH-X01 | Login email không tồn tại | 401 `credentials: invalid` (giống sai mật khẩu — không lộ email nào đã đăng ký) |
| AUTH-X02 | Header `Authorization: Token <chữ ký sai>` / token hết hạn | 401 `token: is invalid` |
| AUTH-X03 | Header `Bearer <token>` | 401 (spec dùng `Token`) |
| AUTH-X04 | PUT đổi username/email sang cái người khác đang dùng | 409 `has already been taken` |
| AUTH-X05 | Response không bao giờ có `password` | |
| AUTH-X06 | Đăng ký mật khẩu < 8 ký tự | 422 (cùng chính sách với PUT) |
| AUTH-X07 | Hai request đăng ký trùng cùng lúc | một 201, một 409, không 500 (bắt lỗi unique `23505`) |
| AUTH-X08 | Body thiếu lớp bọc `user` | 422 `user: can't be blank` |
| AUTH-X09 | `?lang=vi` khi lỗi validation | câu tiếng Việt |
| AUTH-X10 | Field lạ (`id`, `token`) trong body | bị bỏ qua (`whitelist`) |

## Chỗ spec chữ và test vênh nhau
- `error-handling.md` chỉ nói 422 cho lỗi validation; test đòi **409** khi trùng username/email → theo test.
- Spec chữ không nói chính sách mật khẩu; test đòi tối thiểu 8, nhận ít nhất 64 (NIST) → theo test, áp dụng cho cả đăng ký.

## Thay đổi DB
Không. Bảng `users` đã có từ `InitSchema` (email, username unique; password `select: false`; bio, image nullable).

## Phần dùng chung cần làm (feature đầu tiên)
1. **Lỗi validation → 422 `{"errors": {"<field>": [...]}}`**: `exceptionFactory` của `I18nValidationPipe`; đi xuống `children` của DTO lồng, key = tên field lá (`email`, không phải `user.email`). Field có lỗi "trống" thì chỉ trả `can't be blank` (test kiểm `[0]`).
2. **Helper exception** `errorsException(status, field, key)` → `{"errors": {field: [t(key)]}}` dùng cho 401/403/404/409.
3. **i18n**: `en/validation.json` đổi sang câu nguyên văn spec; namespace `errors` cho `has already been taken`, `invalid`, `is missing`…
4. **JwtAuthGuard** + decorator `@CurrentUser()`; đọc scheme `Token`.
5. Guard "auth tuỳ chọn" — **để sang feature profiles**, chưa cần ở đây.

## Quyết định kỹ thuật
| Vấn đề | Chọn | Lý do | Đã loại |
|---|---|---|---|
| Ký/xác thực JWT | `@nestjs/jwt` 12 + guard tự viết | Spec dùng scheme `Token`; guard ~30 dòng, dễ hiểu đúng mục tiêu bài học | `@nestjs/authentication` 0.1.x (quá mới, mặc định Bearer); passport-jwt (thêm 2 gói chỉ để đọc 1 header) |
| Hash mật khẩu | `bcryptjs` 3, cost 10 | JS thuần, không build native trên Windows | `bcrypt` (native), argon2 (native) |
| Payload JWT | `{ sub: user.id }`, hết hạn `JWT_EXPIRES_IN` (mặc định `7d`) | Đổi username/email không làm token cũ hỏng | nhét email vào payload |
| Secret | `JWT_SECRET` trong `.env`, thiếu thì app không khởi động | không hard-code | |
| Token trả ở GET /user | token đang dùng (lấy từ header) | Không tự gia hạn phiên khi chỉ đọc | ký token mới mỗi lần |
| Token trả ở login/register/PUT | ký mới | | |
| Trùng username/email | kiểm trước để trả đúng field + bắt `23505` khi đua | kiểm trước cho câu lỗi đúng field; bắt lỗi cho trường hợp đồng thời | chỉ dựa vào constraint DB |
| Email | `trim().toLowerCase()` trước khi lưu và so | `Jake@x.com` và `jake@x.com` là một người | phân biệt hoa thường |
| Mật khẩu | 8–72 ký tự | NIST tối thiểu 8; bcrypt chỉ dùng 72 byte đầu → chặn trên để không âm thầm cắt | không giới hạn trên |

## Key i18n
| Key | en (nguyên văn spec) | vi |
|---|---|---|
| `validation.isNotEmpty` / `isDefined` | can't be blank | không được để trống |
| `validation.isEmail` / `isString` | is invalid | không hợp lệ |
| `validation.minLength` | is too short (minimum is {constraint1} characters) | quá ngắn (tối thiểu {constraint1} ký tự) |
| `validation.maxLength` | is too long (maximum is {constraint1} characters) | quá dài (tối đa {constraint1} ký tự) |
| `errors.taken` | has already been taken | đã có người dùng |
| `errors.invalid` | invalid | không đúng |
| `errors.tokenMissing` | is missing | bị thiếu |
| `errors.tokenInvalid` | is invalid | không hợp lệ |

## Chia PR
| PR | Nội dung | Case | Ước lượng dòng |
|---|---|---|---|
| ✅ auth-1 | Phần dùng chung 1–3 + `POST /users` + `POST /users/login` + ký JWT | AUTH-01, 02, E01–E10, X01, X05–X10 | ~350 |
| ✅ auth-2 | JwtAuthGuard + `@CurrentUser` + `GET /user` + `PUT /user` | AUTH-03–10, E11–E18, X02–X04 | ~300 |

## Câu hỏi mở
Không còn câu chặn. Hai mặc định đã chọn (đổi được nếu trainer muốn khác): email không phân biệt hoa thường; GET /user trả lại token đang dùng.

## Tiến độ
- 2026-11-09 auth-1, auth-2 xong: `test/auth.e2e-spec.ts` (17 case), `test/user.e2e-spec.ts` (22 case), tất cả xanh.
- Lệch kế hoạch: thêm `src/app.setup.ts` (`configureApp`) để main.ts và e2e dùng chung cấu hình; test i18n cũ (`/api/ping`) đổi sang định dạng lỗi 422 của spec.
