# RealWorld spec (bản lưu cục bộ)

Nguồn: https://github.com/realworld-apps/realworld — commit `25588846c314b15a5e427ffe816e6b4af7be68c7`, tải ngày 2026-11-09. Giấy phép MIT (xem `LICENSE`).
Không sửa các file ở đây. Muốn cập nhật thì tải lại cả thư mục và ghi lại commit.

| File | Nội dung |
|---|---|
| `features.md`, `introduction.md` | Tổng quan tính năng |
| `endpoints.md` | Danh sách endpoint, field bắt buộc, auth |
| `api-response-format.md` | Hình dạng JSON trả về |
| `error-handling.md` | Định dạng lỗi, câu lỗi validation |
| `openapi.yml` | Schema đầy đủ (OpenAPI) |
| `hurl/*.hurl` | **Bộ API test chính thức**: nguồn sự thật khi spec chữ và test vênh nhau |

## Feature → endpoint → file test

| Feature | Endpoint | File Hurl | Cần có trước |
|---|---|---|---|
| `auth` | `POST /users`, `POST /users/login`, `GET /user`, `PUT /user` | `auth`, `errors_auth` | |
| `profiles` | `GET /profiles/:username`, `POST`/`DELETE /profiles/:username/follow` | `profiles`, `errors_profiles` | auth |
| `articles` | `GET /articles` (lọc tag/author/favorited, limit/offset), `GET /articles/feed`, `GET`/`POST`/`PUT`/`DELETE /articles/:slug` | `articles`, `feed`, `pagination`, `errors_articles` | auth, profiles (feed) |
| `comments` | `GET`/`POST /articles/:slug/comments`, `DELETE /articles/:slug/comments/:id` | `comments`, `errors_comments` | articles |
| `authorization` | 403 khi sửa/xoá article hoặc comment của người khác | `errors_authorization` | articles, comments |
| `favorites` | `POST`/`DELETE /articles/:slug/favorite` | `favorites` | articles |
| `tags` | `GET /tags` | `tags` | articles (tag được tạo kèm article) |

Chạy: `node .claude/skills/qa-test-feature/scripts/chay-hurl.mjs <feature>`.

## Hợp đồng tra nhanh (rút từ bộ test, chỗ dễ sai)

**Request/response luôn bọc key:** body vào `{"user": {...}}`, `{"article": {...}}`, `{"comment": {...}}`; trả về `{"user"}`, `{"profile"}`, `{"article"}`, `{"articles": [...], "articlesCount": n}`, `{"comment"}`, `{"comments": [...]}`, `{"tags": [...]}`.

**Auth header:** `Authorization: Token <jwt>`, không phải `Bearer`.

**Mã trạng thái:**
| Trường hợp | Mã |
|---|---|
| Đăng ký, tạo article, tạo comment | **201** |
| Xoá article, xoá comment | **204** |
| Validation sai | 422 |
| Đăng ký trùng username/email | **409** (không phải 422) |
| Thiếu/sai token | 401 |
| Sai mật khẩu khi login | 401 |
| Không phải chủ (sửa/xoá) | 403 |
| Không thấy | 404 |

**Body lỗi:** luôn là `{"errors": {"<key>": ["<câu>"]}}`. Key là tên field (bỏ lớp bọc `user.`/`article.`). Các câu test kiểm **nguyên văn**:

| Key | Câu | Khi nào |
|---|---|---|
| `<field>` | `can't be blank` | thiếu, `null` hoặc chuỗi rỗng |
| `email` | `is invalid` | email sai định dạng |
| `username`, `email` | `has already been taken` | trùng (409) |
| `token` | `is missing` | 401 do thiếu token |
| `credentials` | `invalid` | 401 do sai email/mật khẩu |
| `article`, `comment` | `forbidden` | 403 |
| `article`, `comment`, `profile` | `not found` | 404 |

**i18n:** locale mặc định `en` phải trả **đúng** các câu trên; bản `vi` là phần thêm cho client gửi `?lang=vi` / `Accept-Language: vi`.

**Khác:**
- `tagList` khi update: không gửi thì giữ nguyên tag cũ; gửi `[]` thì xoá hết; gửi `null` thì 422.
- `slug` chỉ cần duy nhất: hai bài trùng title vẫn phải ra slug khác nhau. Đổi `title` thì đổi `slug`.
- `bio`, `image` của user mới là `null`. `PUT /user` gửi `""` thì lưu thành `null`; gửi `null` cũng hợp lệ. Gửi `email: ""` thì 422 `can't be blank`.
- Danh sách article mới nhất trước; mặc định `limit=20`, `offset=0`; `articlesCount` là tổng số khớp bộ lọc, không phải số phần tử trang hiện tại.
