# articles — review PR art-1 + art-2 + art-3
Ngày: 2026-11-10 · Base: (chưa có git) · Phạm vi: `src/articles/`, `src/profiles/profile.mapper.ts`, `OptionalJwtAuthGuard`, migration `AddArticleIndexes`, `test/articles.e2e-spec.ts`

## Cổng máy (`kiem.mjs`, sau khi sửa)
```
PASS  Không có synchronize: true
PASS  Lint · Typecheck · Unit test (slug 7) · E2E test (articles 47 + auth/user 42)
PASS  Migration khớp entity — "No changes in database schema"
PASS  Sunlint — error=0 warning=31
```
Migration `AddArticleIndexes`: đã `run` → `revert` → `run`; `down()` xoá đúng 2 index `up()` tạo.

## Đúng spec
Không có vi phạm. Review độc lập (subagent chỉ được xem code + `docs/realworld-spec/`) lần từng request của `articles.hurl`, `pagination.hurl`, `errors_articles.hurl`, `errors_authorization.hurl` (trừ feed / favorite / comment): danh sách không có `body`; `tagList` không gửi / `[]` / `null`; `createdAt` giữ, `updatedAt` đổi; slug giữ khi chỉ sửa body; DELETE 204 rỗng; 401 / 403 / 404 đúng key.

## Hiệu năng
`GET /api/articles` với `DB_LOGGING=true`: `limit=1` → **6** câu SQL, `limit=20` → **6** câu SQL. Không N+1.

## Phát hiện
Mỗi phát hiện đã được **xác minh bằng request thật** trước khi sửa; hồi quy ở `test/articles.e2e-spec.ts` › "hồi quy từ review" (fail trước khi sửa).

| # | Hạng | File | Vấn đề (request → kết quả) | Xác minh | Trạng thái |
|---|---|---|---|---|---|
| R-01 | Quan trọng | `articles.service.ts` `findBySlugOrThrow`, `dto/list-articles-query.dto.ts` | `GET/PUT/DELETE /articles/x%00`, `?tag=a%00` (`author`, `favorited`) → **500** (Postgres 22021) | 500 ×4 | ✅ Sửa: slug chứa NUL → 404; query `@NoNulChar()` → 422 |
| R-02 | Quan trọng | `dto/list-articles-query.dto.ts` | `?offset=1e20` qua `@IsInt` (`Number.isInteger(1e20)`) → `OFFSET` vượt bigint → **500**; `1e21` → lỗi cú pháp SQL → 500 | 500 ×2 | ✅ Sửa: `@Max(Number.MAX_SAFE_INTEGER)` → 422 |
| R-03 | Gợi ý | `articles.service.ts` `resolveTags` | Có thể deadlock khi 2 request đồng thời upsert cùng tag mới theo thứ tự ngược | **Không tái hiện**: 40 cặp đồng thời → 80/80 201 | ✅ Vẫn sửa phòng ngừa (1 dòng): sắp tên tag trước upsert → cùng thứ tự khoá |
| R-04 | Gợi ý | `articles.service.ts` `update` | Chỉ đổi `tagList` → `updatedAt` không đổi (TypeORM chỉ ghi bảng nối) | Đúng | ✅ Sửa: đặt `updatedAt = new Date()` khi có `tagList` |
| R-05 | Gợi ý | `tags` | Tag không còn bài nào vẫn nằm trong DB và trong `GET /api/tags` (đang có 7) | Đúng | Để **feature tags**: chỉ liệt kê tag còn được dùng |
| R-06 | — | `create-article.dto.ts` | "Express giới hạn JSON 100 kB → body 100.000 ký tự bị 413" | **Sai**: body 100.000 ký tự → 201; 100.001 → 422 đúng định dạng | Không sửa |
| R-07 | Ghi chú | `articles.controller.ts` | `GET /articles/feed` hiện rơi vào `:slug` → 404 (test đòi 401) | Đúng (đã dự đoán ở research) | Khi làm feed: khai báo `@Get('feed')` **trước** `@Get(':slug')`. Slug luôn có hậu tố 6 ký tự nên không đụng chữ `feed` |
| S-01 | Gợi ý | `articles.service.ts` | Sunlint C042: biến boolean `titleChanged` thiếu tiền tố | Đúng | ✅ Đổi `isTitleChanged` |

### Sunlint — 11 warning mới (không chặn)
| Rule | Ở đâu | Đánh giá |
|---|---|---|
| S037 anti-cache | 5 handler articles | Như auth: gom vào PR bảo mật chung |
| C018 / C030 | `saveWithNewSlug` ném lại lỗi | Cố ý: chỉ bắt lỗi trùng slug, lỗi khác ném lại cho Nest (500 + log) |
| C018 | `jwt-auth.guard.ts` catch | Cố ý: mọi lỗi verify → 401 `token: is invalid` |

## Bài học → đã đưa vào `.claude/rules/api.md`
Ký tự NUL gây 500 lần thứ hai (auth R-05, articles R-01) → luật: mọi chuỗi từ **path và query** cũng phải chặn NUL, không chỉ body; số từ query phải có `@Max`.

## Kết luận
Sẵn sàng PR. Không lỗi chặn. R-05 chuyển sang feature tags, R-07 ghi cho feature feed.
