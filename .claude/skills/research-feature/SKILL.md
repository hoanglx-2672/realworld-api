---
name: research-feature
description: Bước 1/4 của vòng làm một feature RealWorld (research → implement → review → qa). Đọc spec RealWorld + bộ test Hurl chính thức + code hiện có, chốt hợp đồng API, thay đổi DB, thư viện, key i18n, danh sách case và cách chia PR, ghi ra docs/features/<feature>/research.md. KHÔNG viết code. Dùng khi user nói "research feature X", "tìm hiểu trước khi làm auth/articles/comments…", "phân tích spec", "feature này cần những gì", "chia PR thế nào", hoặc trước khi bắt đầu bất kỳ feature mới nào của realworld-api.
argument-hint: "<auth|profiles|articles|comments|authorization|favorites|tags>"
---

# Research feature

Mục tiêu: trước khi viết dòng code nào, biết **chính xác** feature phải làm gì (theo test chính thức), chạm vào đâu trong code, và chia thành những PR nào. Đầu ra là `docs/features/<feature>/research.md`, input của `implement-feature`.

## Nguồn, theo thứ tự tin cậy

1. `docs/realworld-spec/hurl/<file>.hurl`: bộ test chính thức. Mã trạng thái, câu lỗi, hình dạng JSON ở đây là **luật**. Bảng feature → file nằm trong `docs/realworld-spec/README.md`.
2. `docs/realworld-spec/README.md`: bảng hợp đồng tra nhanh (mã trạng thái, câu lỗi, chỗ dễ sai).
3. `docs/realworld-spec/endpoints.md`, `api-response-format.md`, `error-handling.md`, `openapi.yml`.
4. Code hiện có: `src/**/*.entity.ts`, `src/database/typeorm.options.ts`, các module đã làm, `src/i18n/`.
5. API thư viện: đọc `node_modules/<gói>/dist/*.d.ts` hoặc https://docs.nestjs.com/llms.txt. Nest 12 mới hơn trí nhớ của model, **đừng đoán**. Có gói first-party thì xem trước (AGENTS.md có danh sách, ví dụ `@nestjs/authentication` cho đăng nhập).

Khi spec chữ và file Hurl vênh nhau (ví dụ đăng ký trùng: chữ ghi 422, test đòi **409**) thì theo Hurl, và ghi rõ chỗ vênh vào research.md.

## Quy trình

1. **Xác định feature** từ tham số hoặc câu của user. Không rõ thì hỏi. Kiểm các feature "cần có trước" (bảng trong README spec) đã xong chưa. Chưa xong thì báo user.
2. **Đọc hết file Hurl của feature**, liệt kê từng request: method, path, auth, body, mã mong đợi, assert. Đây là danh sách case nghiệm thu.
3. **Đối chiếu với code**: entity/cột nào đã có, cái gì thiếu (cột, index, unique, quan hệ), có cần migration không. Có thứ gì đang sai spec thì ghi lại (ví dụ cột đang NOT NULL mà spec đòi null).
4. **Phần dùng chung** mà feature này kéo theo, nếu chưa có trong code (feature `auth` đầu tiên sẽ phải làm hết):
   - Filter đổi lỗi validation thành 422 `{"errors": {"<field>": ["..."]}}`, bỏ tiền tố bọc `user.`/`article.`.
   - Guard JWT đọc `Authorization: Token <jwt>`, thiếu thì 401 `{"errors": {"token": ["is missing"]}}`. Thêm guard "auth tuỳ chọn" cho endpoint công khai nhưng trả `following`/`favorited` theo người xem.
   - Exception 404/403/409 có body đúng spec.
   - `en/validation.json` đổi sang **đúng** câu spec (`can't be blank`, `is invalid`…), `vi/` là bản dịch.
5. **Quyết định kỹ thuật**: thư viện (kèm lý do, phiên bản trong `package.json`), cách sinh slug, cách đếm `articlesCount`, transaction ở đâu, cách tránh N+1 khi trả `author.following` / `favorited`.
6. **Case ngoài bộ test** (ít nhất 5): chuỗi rất dài, unicode trong title/slug, hai request trùng cùng lúc, token hết hạn / sai chữ ký, `limit` âm hoặc quá lớn, gửi field lạ, `?lang=vi`.
7. **Chia PR**: mỗi PR một nhóm endpoint, ước lượng ≤ 400 dòng. PR đầu của feature thường là phần dùng chung + endpoint đơn giản nhất.
8. **Câu hỏi mở**: thứ spec không nói mà cần user quyết định. Hỏi user (AskUserQuestion) trước khi kết thúc; đừng tự chọn những gì thuộc về user.
9. Ghi file theo khuôn dưới, rồi báo user: số case nghiệm thu, số PR dự kiến, câu hỏi còn mở.

## Khuôn `docs/features/<feature>/research.md`

```markdown
# <feature> — research
Ngày: YYYY-MM-DD · Spec: docs/realworld-spec @ 2558884 · Phụ thuộc: <feature trước, đã xong?>

## Endpoint
| # | Method | Path | Auth | Body vào | Trả về | Mã |
|---|---|---|---|---|---|---|

## Case nghiệm thu (từ Hurl)
| ID | File:dòng | Mô tả | Mã | Assert chính |
|---|---|---|---|---|
| AUTH-01 | auth.hurl:1 | Đăng ký thành công | 201 | $.user.token tồn tại, bio = null |

## Case thêm (ngoài bộ test)
| ID | Mô tả | Mong đợi |
|---|---|---|

## Chỗ spec chữ và test vênh nhau
## Thay đổi DB
<entity/cột/index; có cần migration không; tên migration dự kiến>

## Phần dùng chung cần làm
## Quyết định kỹ thuật
| Vấn đề | Chọn | Lý do | Đã loại |
|---|---|---|---|

## Key i18n
| Key | en | vi |
|---|---|---|

## Chia PR
| PR | Nội dung | Case | Ước lượng dòng |
|---|---|---|---|

## Câu hỏi mở
- [ ] ...
```

ID case (`AUTH-01`, `ART-07`…) dùng xuyên suốt: tên test e2e, review, QA đều trích ID này.

## Không làm
- Không viết code, không tạo migration ở bước này.
- Không chép nguyên file Hurl vào research.md; trích `file:dòng`.
- Không bịa hành vi spec không nói. Ghi vào "Câu hỏi mở".
