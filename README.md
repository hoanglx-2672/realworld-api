# RealWorld API — NestJS

Backend (chỉ API) clone Medium theo spec [RealWorld](https://realworld-docs.netlify.app/specifications/backend/endpoints/), làm theo [Framgia Training Guideline — NestJS](https://github.com/framgia/Training-Guideline/blob/master/Nodejs/tutorial.md).

NestJS 12 (ESM) · TypeScript 6 · Node 24 · TypeORM 1.x + PostgreSQL 17 · `@nestjs/i18n` (en, vi) · JWT · Vitest

## Tiến độ

| Chức năng | Endpoint | Trạng thái |
|---|---|---|
| Đăng ký, đăng nhập (JWT) | `POST /api/users`, `POST /api/users/login` | Xong |
| User hiện tại | `GET /api/user`, `PUT /api/user` | Xong |
| Article (CRUD) | `POST /api/articles`, `GET` / `PUT` / `DELETE /api/articles/:slug` | Xong |
| Danh sách article có phân trang | `GET /api/articles?tag=&author=&favorited=&limit=&offset=` | Xong |
| Tag | `GET /api/tags` | Xong |
| Comment | `GET` / `POST /api/articles/:slug/comments`, `DELETE …/comments/:id` | Đang làm |
| Profile, follow | `GET /api/profiles/:username`, `POST` / `DELETE …/follow` | Chưa |
| Favorite | `POST` / `DELETE /api/articles/:slug/favorite` | Chưa |
| Feed | `GET /api/articles/feed` | Chưa |

## Chạy

Cần Node 24 và Docker.

```bash
npm install
cp .env.example .env     # rồi điền JWT_SECRET (xem bên dưới)
npm run db:up            # Postgres trong Docker
npm run migration:run    # tạo bảng
npm run start:dev        # http://localhost:3000/api
```

```bash
curl localhost:3000/api/tags
curl -X POST localhost:3000/api/users -H 'Content-Type: application/json' \
  -d '{"user":{"username":"jake","email":"jake@example.com","password":"password123"}}'
```

## Biến môi trường

Danh sách đầy đủ trong `.env.example`. Biến bắt buộc mà để trống thì app dừng ngay lúc khởi động và báo rõ biến nào thiếu.

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `HOST` | (trống) | Địa chỉ lắng nghe; trống = mọi địa chỉ |
| `PORT` | `3000` | Cổng HTTP |
| `NODE_ENV` | `development` | Môi trường chạy |
| `DB_HOST`, `DB_PORT` | `localhost`, `5432` | Postgres |
| `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | bắt buộc | Khớp `docker-compose.yml` (`realworld`) |
| `DEFAULT_LOCALE` | `en` | Ngôn ngữ khi request không chỉ định |
| `JWT_SECRET` | bắt buộc | Tạo: `node -e "console.log(crypto.randomBytes(48).toString('base64url'))"` |
| `JWT_EXPIRES_IN` | `7d` | Số giây hoặc dạng `15m`, `12h`, `7d` |
| `LOGIN_THROTTLE_LIMIT`, `LOGIN_THROTTLE_TTL_MS` | `10`, `60000` | Số lần login tối đa mỗi IP trong khoảng thời gian (ms) |
| `TRUST_PROXY` | trống | Chạy sau reverse proxy: số proxy tin cậy (vd. `1`) để đếm throttle theo IP thật |

## Gọi API

- Body vào và ra luôn bọc key: `{"user": {...}}`, `{"article": {...}}`, `{"articles": [...], "articlesCount": n}`.
- Xác thực: `Authorization: Token <jwt>` (không phải `Bearer`).
- Lỗi luôn có dạng `{"errors": {"<field>": ["<câu>"]}}`. Mã: validation 422, trùng 409, thiếu/sai token 401, không phải chủ 403, không thấy 404, login quá số lần 429.
- Ngôn ngữ câu lỗi: `?lang=vi`, header `x-lang: vi` hoặc `Accept-Language: vi`. Mặc định tiếng Anh, đúng nguyên văn spec.

## Kiểm thử

```bash
npm test               # unit
npm run test:e2e       # e2e, cần Postgres đang chạy (npm run db:up)
npm run lint
npm run format:check
npm run sunlint        # SunLint (Sun* coding rules), cấu hình ở sunlint.config.json
```

CI (GitHub Actions) chạy lint, format, typecheck, unit, build, migration và e2e cho mỗi PR.

## Migration

Không dùng `synchronize`. Đổi schema:

```bash
# sửa entity, rồi:
npm run migration:generate -- src/database/migrations/<TenPascalCase>
# đọc up()/down() trong file sinh ra, rồi thử chạy và hoàn tác:
npm run migration:run
npm run migration:revert && npm run migration:run
```

`npm run migration:show` liệt kê migration đã chạy (`[X]`) và chưa chạy (`[ ]`). Không sửa migration đã merge: cần đổi thì tạo migration mới.

## Cấu trúc

```
src/
├── main.ts, app.module.ts, app.setup.ts   # khởi động; prefix /api, pipe validation (dùng chung với e2e)
├── common/      # filter lỗi chung, validator, BaseEntity, no-store middleware
│   └── constants/, types/, utils/   # hằng số, type, hàm phụ dùng chung
├── auth/        # JWT, JwtAuthGuard / OptionalJwtAuthGuard, @CurrentAuth()
├── users/       # đăng ký, đăng nhập, GET/PUT /user, giới hạn login
├── articles/    # CRUD, danh sách, slug
├── tags/        # GET /tags
├── profiles/    # hình dạng Profile dùng chung
├── comments/    # entity
├── database/    # cấu hình TypeORM (app và CLI dùng chung), migrations
└── i18n/{en,vi}/  # bản dịch
test/            # e2e (supertest + Postgres thật)
```

Mỗi module tách riêng: `<module>.constants.ts` (hằng số), `<module>.types.ts` (interface/type), `<module>.utils.ts` (hàm phụ). File controller / service / guard / DTO chỉ import, không khai báo hằng số hay hàm phụ ở đầu file.
