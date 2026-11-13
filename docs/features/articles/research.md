# articles — research
Ngày: 2026-11-10 · Spec: docs/realworld-spec @ 2558884 · Phụ thuộc: auth ✅

Spec chức năng: *"CRUD Articles"* + *"GET and display paginated lists of articles"*.
**Ngoài phạm vi lần này:** `GET /articles/feed` (cần follow, ý 7) và favorite/unfavorite (ý 6). Các field `favorited`, `favoritesCount`, `author.following` vẫn được **tính đúng** từ bảng `favorites` / `follows` (đọc), chỉ chưa có API để ghi vào hai bảng đó.

## Endpoint
| # | Method | Path | Auth | Body vào | Trả về | Mã |
|---|---|---|---|---|---|---|
| 1 | POST | `/api/articles` | bắt buộc | `{"article": {title, description, body, tagList?}}` | `{"article": Article}` | 201 |
| 2 | GET | `/api/articles/:slug` | tuỳ chọn | — | `{"article": Article}` | 200 |
| 3 | PUT | `/api/articles/:slug` | bắt buộc, chủ bài | `{"article": {title?, description?, body?, tagList?}}` | `{"article": Article}` | 200 |
| 4 | DELETE | `/api/articles/:slug` | bắt buộc, chủ bài | — | (rỗng) | **204** |
| 5 | GET | `/api/articles?tag=&author=&favorited=&limit=&offset=` | tuỳ chọn | — | `{"articles": [...], "articlesCount": n}` | 200 |

`Article` = `{slug, title, description, body, tagList, createdAt, updatedAt, favorited, favoritesCount, author: {username, bio, image, following}}`.
Trong **danh sách**, mỗi phần tử **không có `body`** (articles.hurl:55 `body not exists`).

## Case nghiệm thu (từ Hurl)
| ID | File:dòng | Mô tả | Mã | Assert chính |
|---|---|---|---|---|
| ART-01 | articles.hurl:14 | Tạo bài có tag | 201 | slug chuỗi; tagList đúng thứ tự `[d_, t_]`; createdAt/updatedAt ISO; favorited false; favoritesCount 0; author.username |
| ART-02 | articles.hurl:45,138 | Danh sách không auth | 200 | `articles` list, `articlesCount` int ≥ 1, phần tử **không có body** |
| ART-03 | articles.hurl:63 | Lọc `?author=` | 200 | mọi phần tử đúng tác giả |
| ART-04 | articles.hurl:81,100 | Danh sách có auth | 200 | như ART-02, `favorited` boolean |
| ART-05 | articles.hurl:119 | Lọc `?tag=` | 200 | phần tử chứa tag |
| ART-06 | articles.hurl:145 | Xem một bài | 200 | đủ field, có body |
| ART-07 | articles.hurl:160,184 | Sửa body → slug, title giữ nguyên; `createdAt` không đổi, `updatedAt` đổi | 200 | tagList vẫn 2 |
| ART-08 | articles.hurl:202 | Sửa không gửi tagList → giữ tag cũ | 200 | count 2 |
| ART-09 | articles.hurl:217,230 | `tagList: []` → xoá hết tag | 200 | count 0, GET lại vẫn 0 |
| ART-10 | articles.hurl:237 | `tagList: null` → từ chối | 422 | |
| ART-11 | articles.hurl:247,252 | Xoá → 204, GET lại 404 | 204/404 | `errors.article[0]` = `not found` |
| ART-12 | pagination.hurl:45 | `?author=&limit=1` → bài mới nhất | 200 | count 1, articlesCount 2, slug2 |
| ART-13 | pagination.hurl:53 | `limit=1&offset=1` → bài cũ hơn | 200 | slug1 |
| ART-E01 | errors_articles.hurl:1 | Tạo không token | 401 | `token: is missing` |
| ART-E02 | errors_articles.hurl:14 | GET slug không tồn tại | 404 | `article: not found` |
| ART-E03 | errors_articles.hurl:20,31 | PUT / DELETE không token | 401 | |
| ART-E04 | errors_articles.hurl:68,82,96 | title / description / body rỗng | 422 | `can't be blank` |
| ART-E05 | errors_articles.hurl:110 | Hai bài trùng title → slug khác nhau | 201 | |
| ART-E06 | errors_articles.hurl:139,177 | PUT / DELETE slug không tồn tại | 404 | `article: not found` |
| ART-E07 | errors_authorization.hurl:41,48 | User B xoá / sửa bài của A | **403** | `article: forbidden` |

**Sẽ hỏng tới khi làm feature sau** (ghi nhận, không phải lỗi): errors_articles.hurl:37 (`GET /articles/feed` không token → hiện route chưa có, rơi vào `GET /articles/:slug` → 404 thay vì 401), :43, :49, :151, :158 (favorite/unfavorite). errors_authorization.hurl:60–84 cần comments.

## Case thêm (ngoài bộ test)
| ID | Mô tả | Mong đợi |
|---|---|---|
| ART-X01 | Title tiếng Việt `"Học NestJS từ đầu"` | slug `hoc-nestjs-tu-dau-xxxxxx` (bỏ dấu, đ → d) |
| ART-X02 | Title chỉ có emoji / ký tự đặc biệt | slug vẫn hợp lệ (`article-xxxxxx`) |
| ART-X03 | Đổi title → slug đổi; slug cũ → 404 | |
| ART-X04 | tagList có phần tử trùng / khoảng trắng / rỗng | trùng bị gộp, trim; rỗng → 422 |
| ART-X05 | `limit=0`, `limit=-1`, `limit=abc`, `offset=-1` | 422 |
| ART-X06 | `limit=1000` | 422 (tối đa 100) |
| ART-X07 | `articlesCount` = tổng theo bộ lọc, không phải số phần tử trang | |
| ART-X08 | Không gửi token ở GET → `favorited` false, `following` false; token hỏng → 401 | |
| ART-X09 | Sửa field lạ (`slug`, `author`) trong body | bị bỏ qua (`whitelist`) |
| ART-X10 | Xoá bài có comment / tag / favorite | xoá được (FK `ON DELETE CASCADE`), không 500 |
| ART-X11 | Hai request tạo cùng tag mới cùng lúc | không 500 (tag dùng upsert) |
| ART-X12 | Danh sách 20 bài | số câu SQL không tăng theo số bài (không N+1) |

## Thay đổi DB
- Bảng đã đủ từ `InitSchema`. **Thêm migration `AddArticleIndexes`**: index `articles(author_id)` (lọc theo tác giả — Postgres không tự tạo index cho khoá ngoại) và `articles(created_at)` (sắp xếp mới nhất).

## Phần dùng chung cần làm
1. `OptionalJwtAuthGuard`: không token → cho qua, `auth` = undefined; token hỏng → 401 `token: is invalid` (không lặng lẽ coi là khách).
2. `toProfile(user, following)` trong `src/profiles/profile.mapper.ts` — feature profiles sẽ dùng lại.
3. Key i18n `errors.notFound`, `errors.forbidden`; key validation cho `isArray`, `arrayMaxSize`, `isInt`, `min`, `max`.
4. Thêm `isArray` vào nhóm lỗi gốc của `validationExceptionFactory`.

## Quyết định kỹ thuật
| Vấn đề | Chọn | Lý do | Đã loại |
|---|---|---|---|
| Slug | `slugify(title)` + `-` + 6 ký tự ngẫu nhiên base36 | luôn duy nhất mà không cần truy vấn kiểm trước; spec chỉ đòi duy nhất | đánh số `-2`, `-3` (phải truy vấn, đua nhau khi tạo đồng thời) |
| Slug tiếng Việt | NFD + bỏ dấu + `đ→d` + chữ thường + `[^a-z0-9]+ → -` | URL đọc được | giữ nguyên unicode (URL bị mã hoá %) |
| Thứ tự tagList | sắp xếp **alphabet** | spec không quy định; ổn định giữa các lần đọc; khớp test; không cần cột thứ tự | lưu vị trí (cần migration + cột `position`) |
| Tạo tag | `upsert` theo `name` rồi đọc lại | hai request tạo cùng tag mới không gây lỗi unique | find-or-create (đua nhau → 500) |
| Danh sách | 1) truy vấn id + `count` theo bộ lọc · 2) nạp bài + author + tags theo id · 3) gộp `favoritesCount`, `favorited`, `following` bằng 3 truy vấn `IN (...)` | số truy vấn cố định (≈5) dù trang có 20 bài | `getManyAndCount` + join toàn bộ quan hệ (TypeORM sinh subquery DISTINCT nặng; vẫn phải N+1 cho following) |
| Thứ tự danh sách | `created_at DESC, id DESC` | mới nhất trước (spec); `id` phá hoà khi cùng thời điểm | |
| limit / offset | limit 1–100, mặc định 20; offset ≥ 0, mặc định 0 | openapi: `minimum: 1`, `default: 20`, `minimum: 0`; chặn trên 100 để không kéo cả bảng | không giới hạn |
| Xoá | `@HttpCode(204)` | test đòi 204 | |
| Kiểm chủ bài | so `article.author.id` với `auth.userId` trong service | | chỉ kiểm ở client |

## Key i18n
| Key | en (nguyên văn spec) | vi |
|---|---|---|
| `errors.notFound` | not found | không tìm thấy |
| `errors.forbidden` | forbidden | không có quyền |
| `validation.isArray` | is invalid | không hợp lệ |
| `validation.arrayMaxSize` | is too long (maximum is {constraint1} items) | quá nhiều (tối đa {constraint1} phần tử) |
| `validation.isInt` | must be an integer | phải là số nguyên |
| `validation.min` | must be greater than or equal to {constraint1} | phải lớn hơn hoặc bằng {constraint1} |
| `validation.max` | must be less than or equal to {constraint1} | phải nhỏ hơn hoặc bằng {constraint1} |

## Chia PR
| PR | Nội dung | Case | Ước lượng dòng |
|---|---|---|---|
| ✅ art-1 | Phần dùng chung 1–4 + slug + `POST /articles` + `GET /articles/:slug` | ART-01, 06, E01, E02, E04, E05, X01, X02, X04, X08, X09 | ~400 |
| ✅ art-2 | `PUT` + `DELETE /articles/:slug` + kiểm chủ bài | ART-07–11, E03, E06, E07, X03, X10 | ~250 |
| ✅ art-3 | `GET /articles` lọc + phân trang + migration index | ART-02–05, 12, 13, X05–X07, X12 | ~300 |
| ✅ art-4 | Hardening sau review toàn bộ code (xem dưới) | ART4-01 … ART4-12 | ~380 (230 là test) |

### PR art-4 hardening (2026-11-12)
Nguồn: review độc lập toàn bộ `src/` + `test/` ngày 2026-11-11; lỗi 1 và 3 đã tái hiện trên app trước khi sửa.
| ID | Case | Trước | Sau |
|---|---|---|---|
| ART4-01 | Token của user đã bị xoá → `POST /articles` | 500 (FK 23503) + tag mồ côi | 401 `token: is invalid`, không còn tag |
| ART4-02/03 | Token ma → PUT/DELETE, GET danh sách | 403 / 200 | 401 |
| ART4-04/05 | Header sai dạng (`Bearer x`, `Token`, `abc`) | khách (200) / `is missing` | 401 `token: is invalid` |
| ART4-07 | PUT và DELETE cùng lúc | bài "sống lại" (tái hiện 1/5 lần) | 404, nhờ `SELECT … FOR UPDATE` trong transaction |
| ART4-08–10 | Lớp bọc `article` sai, vượt giới hạn độ dài | chưa có test | 422 (có test) |
| ART4-11 | `favorited` / `following` = true | chưa có test | đúng (có test) |
| ART4-12 | i18n vi cho 403/404 | chưa có test | đúng (có test) |

Quyết định:
- Guard kiểm user còn tồn tại bằng `existsBy` (thêm 1 truy vấn theo khoá chính mỗi request có token). `AuthModule` export `TypeOrmModule.forFeature([User])` để module nào dùng guard cũng tiêm được.
- Transaction cho `create` / `update`; khi slug trùng thì chạy lại **cả** transaction (Postgres huỷ transaction sau câu lỗi).
- Khoá bằng câu `SELECT id … FOR UPDATE` riêng (không JOIN): Postgres không cho FOR UPDATE trên phía nullable của LEFT JOIN.
- Dọn code: `IfPresent`, `TrimEach` chuyển về `common/validators.ts`; giới hạn độ dài có tên hằng; `protected` → `private`; `resolveTags` thành hàm nhận `EntityManager`; `data-source.ts` bỏ khối catch rỗng.
- Hoãn (ghi nhận): exception filter chung cho JSON hỏng / 500 (QA-auth-01); thu hồi token khi đổi mật khẩu, rate limit, Cache-Control (PR auth-3); service trả `{article}` thay vì để controller bọc; demo `/api/ping`.
- 2026-11-12 (sau art-4): các mục hoãn trên đã xử lý hoặc chốt trong `docs/tracker.html` (ISS-01 filter, ISS-03 không thu hồi token theo spec, ISS-04 Cache-Control, ISS-10 lớp bọc, ISS-12 xoá `/api/ping`; rate limit = ISS-20 chờ quyết).

## Câu hỏi mở
Không còn câu chặn. Đã chọn mặc định (đổi được): tagList sắp alphabet; limit tối đa 100; token hỏng ở endpoint tuỳ chọn → 401.

## Tiến độ
- 2026-11-10 art-1, art-2, art-3 xong. `test/articles.e2e-spec.ts` 47 case + `src/articles/slug.spec.ts` 7 case, tất cả xanh.
- Review: 7 phát hiện, 5 đúng → đã sửa (R-01, R-02, R-03 phòng ngừa, R-04, S-01); R-05 chuyển sang feature tags; R-06 sai.
- Lệch kế hoạch: không có.
- 2026-11-12 art-4 xong: 20 case mới xanh; toàn bộ e2e 120/120, unit 9/9; cổng kiểm 7 PASS, Sunlint 0 lỗi, 28 cảnh báo (trước 31), điểm 70.6. Hurl: auth 43/43, articles 17/17, pagination 7/7, errors_articles 15/20 (5 hỏng như cũ: feed, favorite).
