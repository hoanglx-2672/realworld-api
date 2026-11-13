---
name: review-feature
description: Bước 3/4 của vòng làm một feature RealWorld (research → implement → review → qa). Review thay đổi của một PR trước khi mở/cập nhật pull request — cổng máy (lint, typecheck, test, migration khớp entity, không commit .env, cỡ PR, Sunlint bắt buộc 0 error) + soát đúng spec RealWorld, bảo mật, TypeORM, i18n, test — ghi docs/features/<feature>/review.md và soạn mô tả PR. Dùng khi user nói "review feature X", "review PR", "soát code", "kiểm trước khi PR", "PR này ổn chưa", "chạy sunlint", "viết mô tả PR", hoặc trước mọi lần git push / gh pr create.
argument-hint: "<feature> [--base=main]"
---

# Review feature

Hai phần: **máy kiểm** (script) và **người kiểm** (đọc diff theo checklist). Chỉ báo cáo, **không tự sửa** trừ khi user bảo.

## 1. Cổng máy

```bash
node .claude/skills/review-feature/scripts/kiem.mjs              # đủ mục (cần Postgres đang chạy)
node .claude/skills/review-feature/scripts/kiem.mjs --nhanh      # bỏ e2e + migration
node .claude/skills/review-feature/scripts/kiem.mjs --base=develop
```

| Mục | FAIL khi | Sửa |
|---|---|---|
| `.env` không bị commit | `.env` nằm trong git | `git rm --cached .env` |
| Không có `synchronize: true` | có trong `src/` | xoá, dùng migration |
| Cỡ PR | > 400 dòng (WARN) | tách PR hoặc giải thích trong mô tả |
| Không sửa migration đã có trên base | file migration bị M/D/R | hoàn tác, tạo migration mới |
| Lint / Typecheck / Unit / E2E | lệnh lỗi | sửa code, không sửa test cho qua |
| Migration khớp entity | còn migration chưa chạy, hoặc `generate` thấy chênh | `migration:run` / tạo migration |
| Sunlint | chưa cài, hoặc còn error | xem dưới |

**Sunlint** (guideline bắt buộc fix 100% error): chưa cài thì hỏi user **một lần** có cài `npm install -g @sun-asterisk/sunlint` không. Không tự cài, **không bao giờ báo PASS khi tool chưa chạy**. Còn error thì đọc `.reports/sunlint.json` và liệt kê từng rule.

## 2. Người kiểm

Lấy diff: `git diff <base>...HEAD` (chưa có git thì hỏi user phạm vi file). Đọc kèm `docs/features/<feature>/research.md` và `docs/realworld-spec/README.md`.

Muốn một góc nhìn không bị neo vào cách mình đã code: giao cho một subagent **chỉ** diff + thư mục `docs/realworld-spec/`, nhờ tìm chỗ sai spec. Không đưa kết luận của mình cho nó.

Checklist, đi theo thứ tự:

**A. Đúng spec** (lỗi ở đây xếp hạng `Sai spec`)
- [ ] Mỗi case nghiệm thu của PR (ID trong research.md) có test tương ứng và đang xanh.
- [ ] Body vào/ra bọc đúng key; tên field camelCase đúng spec (`tagList`, `favoritesCount`, `createdAt`…).
- [ ] Mã trạng thái: 201 tạo, 204 xoá, 200 login, 409 trùng, 401/403/404/422 đúng chỗ.
- [ ] Body lỗi `{"errors": {"<key>": ["<câu nguyên văn>"]}}`, locale `en` khớp nguyên văn bảng hợp đồng.
- [ ] `Authorization: Token`, endpoint "auth tuỳ chọn" không 401 khi thiếu token.

**B. Bảo mật** (`Nghiêm trọng`)
- [ ] Không trả `password`/hash; không log token/mật khẩu.
- [ ] Kiểm chủ sở hữu ở service trước khi sửa/xoá.
- [ ] JWT secret từ env; hết hạn có đặt; sai chữ ký → 401.
- [ ] Không ghép chuỗi vào SQL (dùng tham số của QueryBuilder).
- [ ] DTO `whitelist` chặn field lạ (không thể tự set `author`, `id`…).

**C. Dữ liệu / TypeORM** (`Quan trọng`)
- [ ] Không N+1 trong danh sách; `articlesCount` đúng bộ lọc.
- [ ] Ghi nhiều bảng (article + tags) trong transaction.
- [ ] Unique/index cho cột tra cứu (`slug`, `username`, `email`); migration có `down()` đúng.
- [ ] Bắt lỗi unique của Postgres (code `23505`) → 409, không để lộ 500.

**D. Nest / code** (`Quan trọng` hoặc `Gợi ý`)
- [ ] Controller mỏng, logic ở service; entity không trả thẳng ra ngoài (qua mapper).
- [ ] Mọi câu cho người dùng qua i18n, có cả `en` và `vi`.
- [ ] Import `.js`, không `any` thừa, không `console.log` gỡ lỗi, không code chết; theo Google TS Style Guide.
- [ ] `.env.example` có biến mới.

**E. Test** (`Quan trọng`)
- [ ] Có case lỗi, không chỉ đường thành công; không `it.skip`/`only`; dữ liệu có `uid`, chạy lại được.

## 3. Ghi `docs/features/<feature>/review.md`

```markdown
# <feature> — review PR <n>
Ngày · Base: <nhánh> · Diff: <số dòng>

## Cổng máy
<dán output kiem.mjs>

## Phát hiện
| # | Hạng | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
Hạng: Sai spec > Nghiêm trọng > Quan trọng > Gợi ý

## Kết luận
Sẵn sàng PR / Cần sửa trước (liệt kê # chặn)
```

Mỗi phát hiện phải chỉ được `file:dòng` và nói rõ hậu quả cụ thể (request nào → trả sai gì). Không chắc thì ghi "cần xác minh", không đưa vào hạng `Sai spec`.

## 4. Mô tả PR (khi không còn mục chặn)

```markdown
## Việc làm
<một câu>

## Endpoint
| Method | Path | Auth | Case |
|---|---|---|---|

## Thay đổi DB
<migration nào / không có>

## Kiểm tra
<output kiem.mjs>
- [ ] Sunlint 0 error (ảnh ở comment)
- [ ] Hurl: <feature> pass (nếu đã chạy qa-test-feature)
```

Nhắc user tự chụp ảnh Sunlint đính vào comment PR (guideline yêu cầu). Commit message theo Conventional Commits. Chỉ commit / push / tạo PR khi user bảo.
