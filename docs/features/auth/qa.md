# auth — QA
Ngày: 2026-11-09 · App: `npm run build && node dist/main.js` · Host: http://localhost:3000 · DB: Postgres local (Docker)

## Bộ test chính thức (Hurl, qua npx)
`auth.hurl` + `errors_auth.hurl`: **43/43 request pass** (chạy lại sau khi sửa QA-auth-02: vẫn 43/43). Chi tiết: `qa-hurl.txt`.

## Case thêm
| ID | Case | Mong đợi | Thực tế | Kết quả |
|---|---|---|---|---|
| AUTH-X09 | Không token + `?lang=vi` (guard có dịch không) | 401 câu tiếng Việt | 401 `{"errors":{"token":["bị thiếu"]}}` | Đạt |
| i18n | `Accept-Language: vi-VN,vi;q=0.9` / `x-lang: vi`, email sai | câu tiếng Việt | 422 `không hợp lệ` | Đạt |
| i18n | `?lang=xx` | về `en` | 422 `is invalid` | Đạt |
| — | JSON hỏng | lỗi rõ ràng, không 500 | 400 định dạng mặc định của Nest | **QA-auth-01** |
| — | username 10.000 ký tự | 422 | 422 `is too long (maximum is 255 characters)` | Đạt |
| — | `' OR 1=1 --` trong email login | 422 / 401, không lộ SQL | 422 `is invalid` | Đạt |
| — | username kiểu số | một câu lỗi | 3 câu, có `is too long` vô nghĩa → **QA-auth-02**, đã sửa → `["is invalid"]` | Đạt sau sửa |
| — | username unicode + emoji | 201 | 201 | Đạt |
| — | PUT bio rồi login bằng mật khẩu cũ | 200 (password không bị ghi đè) | 200 | Đạt |
| AUTH-X03 | `Bearer <token thật>` | 401 | 401 `token: is missing` | Đạt |
| AUTH-X02 | token bị sửa 1 ký tự | 401 | 401 `token: is invalid` | Đạt |
| AUTH-X07 | 2 đăng ký trùng cùng lúc (curl song song) | một 201, một 409 | 201, 409 | Đạt |
| AUTH-X05 | `password` trong response | không có | không có | Đạt |
| — | Content-Type | `application/json; charset=utf-8` | đúng | Đạt |
| — | Log app có lỗi 500 / stack | không | không | Đạt |

## Lỗi
### QA-auth-01 JSON hỏng trả định dạng lỗi mặc định của Nest
- Mức: Thấp (spec không quy định; không phải 500, không lộ thông tin)
- Tái hiện:
  ```bash
  curl -s -X POST localhost:3000/api/users -H 'Content-Type: application/json' -d '{"user": {"username": '
  ```
- Mong đợi: `{"errors": {"body": ["..."]}}` cho đồng bộ · Thực tế: `{"message":"Unexpected end of JSON input","error":"Bad Request","statusCode":400}`
- Đề xuất: một `ExceptionFilter` chung chuẩn hoá mọi `HttpException` chưa có `errors` → làm ở PR hạ tầng chung, không chặn auth.

### QA-auth-02 Field sai kiểu trả nhiều câu lỗi (đã sửa)
- `{"user":{"username":123,...}}` → `["is invalid","is too long (maximum is 255 characters)","is invalid"]`.
- Sửa: `validationExceptionFactory` ưu tiên lỗi gốc (`isDefined` > `isNotEmpty` > `isObject` > `isString`), bỏ câu trùng. Test hồi quy: `test/auth-hardening.e2e-spec.ts`.

## Kết luận
**Đạt.** Không lỗi chặn. QA-auth-01 ghi lại cho PR hạ tầng chung.
