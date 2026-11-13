# articles — QA
Ngày: 2026-11-10 · App: `npm run build && node dist/main.js` · Host: http://localhost:3000 · DB: Postgres local (Docker)

## Bộ test chính thức (Hurl, qua npx, `--tiep-tuc`)
| File | Kết quả | Ghi chú |
|---|---|---|
| `articles.hurl` | ✅ **17/17** | chạy lại sau khi sửa review: vẫn 17/17 |
| `pagination.hurl` | ✅ **7/7** | sau sửa: vẫn 7/7 |
| `errors_articles.hurl` | 15/20 | 5 request hỏng **đúng như research dự đoán**: `:39` feed, `:45` `:51` `:156` `:163` favorite — chưa làm (ý 6, 7) |
| `auth.hurl` + `errors_auth.hurl` | ✅ 43/43 | hồi quy auth: không ảnh hưởng |
| `feed.hurl` | 0/12 (hỏng) | cần follow + feed (ý 7) — ngoài phạm vi |
| `errors_authorization.hurl` | chưa chạy | trộn article + comment; chạy khi xong comments |

Chi tiết: `qa-hurl.txt`.

## Case thêm
| ID | Case | Mong đợi | Thực tế | Kết quả |
|---|---|---|---|---|
| ART-X01 | Title tiếng Việt (gửi UTF-8) | slug không dấu, title giữ dấu | `hoc-nestjs-tu-dau-duong-di-sexsxx`, title nguyên dấu, tag `việt nam` | Đạt |
| i18n | `?lang=vi`: sửa bài người khác / slug sai / `limit=abc` | câu tiếng Việt | `không có quyền` 403 · `không tìm thấy` 404 · `phải là số nguyên` 422 | Đạt |
| ART-X04 | 21 tag · tag 51 ký tự · tag là số | 422 | 422 với câu rõ ràng, mỗi field một câu | Đạt |
| — | `?author=x' OR '1'='1` | không lộ dữ liệu | `{"articles":[],"articlesCount":0}` (tham số hoá) | Đạt |
| — | `?tag=a&tag=b` (mảng) | 422 | 422 `tag: is invalid` | Đạt |
| — | body 100.001 ký tự | 422 | 422 `is too long (maximum is 100000 characters)` | Đạt |
| — | `PUT {"article": {}}` | 200, không đổi gì | 200, `updatedAt` không đổi | Đạt |
| — | PUT title giống title cũ | slug giữ nguyên | giữ nguyên | Đạt |
| ART-X11 | 2 bài cùng một tag **mới** tạo đồng thời | 201 + 201, chỉ 1 tag | 201, 201, 1 tag | Đạt |
| ART-11 | DELETE | 204, body rỗng | 204, rỗng | Đạt |
| ART-X12 | Số câu SQL của `GET /articles` (`DB_LOGGING=true`) | không tăng theo số bài | `limit=1` → 6 câu · `limit=20` → 6 câu | Đạt |
| — | Log app có lỗi 500 | không | không | Đạt |

## Sau review (R-01, R-02 — xem review.md)
| Request | Trước | Sau |
|---|---|---|
| `GET /api/articles/x%00` | 500 | 404 |
| `GET /api/articles?tag=a%00` | 500 | 422 |
| `GET /api/articles?offset=1e20` | 500 | 422 |

## Lỗi
### QA-articles-01 Tag phân biệt hoa thường
- Mức: Thấp (spec không quy định)
- Tái hiện: tạo bài với `"tagList": ["nestjs", " NestJS "]`
- Thực tế: `["NestJS", "nestjs"]` — hai tag khác nhau; `?tag=nestjs` không thấy bài gắn `NestJS`.
- Đề xuất: chuẩn hoá tag về chữ thường khi lưu (giống cách email đã làm). **Cần user quyết** — đổi rồi thì tag hiển thị luôn là chữ thường.

### Không phải lỗi app (ghi lại để khỏi nhầm lần sau)
Gửi tiếng Việt bằng `curl -d '...'` trong Git Bash trên Windows → dấu thành `?` (curl đổi tham số dòng lệnh sang code page Windows trước khi gửi). Gửi bằng file `--data-binary @file.json` hoặc REST Client thì đúng. e2e test (supertest) cũng xác nhận server xử lý UTF-8 đúng.

## Kết luận
**Đạt** cho phạm vi CRUD + danh sách. Không lỗi chặn. Hỏng còn lại trong Hurl đều thuộc feed / favorite chưa làm.
