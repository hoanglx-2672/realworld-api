# RealWorld API — NestJS tutorial: Setup · Migration · i18n

Phần mở đầu của tutorial [Framgia Training — NestJS](https://github.com/framgia/Training-Guideline/blob/master/Nodejs/tutorial.md): clone Medium theo spec [RealWorld](https://realworld-docs.netlify.app/specifications/backend/endpoints/), chỉ làm backend API.

Dự án này dừng ở ba việc nền tảng, ứng với hai PR đầu tiên mà guideline yêu cầu (**init code base** → **init model**) cộng i18n. Các chức năng (auth JWT, articles, comments…) sẽ là các PR sau.

Phiên bản: NestJS 12 (ESM), TypeScript 6, TypeORM 1.x, PostgreSQL 17, `@nestjs/i18n`, Vitest, Node 24.

---

## Chạy nhanh

```bash
npm install
cp .env.example .env
npm run db:up            # Postgres trong Docker (cần Docker Desktop đang chạy)
npm run migration:run    # tạo bảng
npm run start:dev        # http://localhost:3000/api

curl localhost:3000/api/tags                     # {"tags":[]}
curl "localhost:3000/api/ping?name=An&lang=vi"   # {"locale":"vi","message":"Xin chào, An!"}
```

## Cấu trúc

```
src/
├── main.ts                     # khởi động app
├── app.setup.ts                # configureApp(): prefix /api, pipe validation (dùng chung với e2e)
├── app.module.ts               # ConfigModule + TypeOrmModule + I18nModule
├── app.controller.ts           # GET /api/ping — thử i18n
├── common/base.entity.ts       # id, created_at, updated_at dùng chung
├── users/user.entity.ts        # users + follows (bảng nối tự tham chiếu)
├── articles/article.entity.ts  # articles + article_tags + favorites
├── comments/comment.entity.ts
├── tags/                       # entity + GET /api/tags (endpoint thật của spec)
├── database/
│   ├── typeorm.options.ts      # cấu hình DB DÙNG CHUNG cho app và CLI
│   ├── data-source.ts          # điểm vào cho TypeORM CLI
│   └── migrations/             # file migration (commit vào git)
└── i18n/{en,vi}/*.json         # bản dịch, mỗi file là một namespace
```

---

## Bước 1 — Setup project (PR "init code base")

### 1.1 Tạo project bằng Nest CLI
```bash
npx @nestjs/cli@12 new realworld-api --package-manager npm
cd realworld-api
```
CLI sinh sẵn: ESM (`"type": "module"`), Vitest, oxlint, Prettier. Ba điều cần nhớ với ESM:
- Import tương đối phải có đuôi `.js`: `import { AppModule } from './app.module.js'` (dù file là `.ts`).
- Không có `__dirname` → dùng `import.meta.dirname`.
- Mock trong test là `vi.fn()`, không phải `jest.fn()`.

### 1.2 Cài thư viện
```bash
npm i @nestjs/config @nestjs/typeorm typeorm pg @nestjs/i18n class-validator class-transformer
```

### 1.3 Biến môi trường
`.env.example` (commit) liệt kê mọi biến; `.env` (KHÔNG commit, đã có trong `.gitignore`) là bản thật trên máy:
```bash
cp .env.example .env
```
`ConfigModule.forRoot({ isGlobal: true })` nạp `.env` cho app.

### 1.4 Postgres bằng Docker
`docker-compose.yml` có sẵn một service `db`, đọc user/pass/db từ `.env`:
```bash
npm run db:up     # docker compose up -d db
npm run db:down   # tắt (dữ liệu vẫn giữ trong volume db-data)
```
Muốn dùng MySQL: đổi image trong compose, `npm i mysql2`, và đổi `type: 'mysql'` trong `typeorm.options.ts`.

### 1.5 Prefix `/api`
Spec RealWorld đặt mọi endpoint dưới `/api` → `app.setGlobalPrefix('api')` trong `src/app.setup.ts`.

---

## Bước 2 — Model & Migration (PR "init model")

### 2.1 Vì sao không dùng `synchronize: true`?
`synchronize` tự sửa bảng theo entity mỗi lần app khởi động — tiện khi học nhưng **có thể xoá cột/mất dữ liệu**, và không để lại lịch sử thay đổi. Dự án thật dùng **migration**: mỗi thay đổi schema là một file có `up()` (áp dụng) và `down()` (hoàn tác), được commit và review như code.

### 2.2 Entities theo spec RealWorld

| Bảng | Từ đâu | Ghi chú |
|---|---|---|
| `users` | `User` | `email`, `username` unique; `password` có `select: false` để không lộ khi query |
| `follows` | `User.following` (`@ManyToMany` tự tham chiếu) | `follower_id` → `following_id` |
| `articles` | `Article` | `slug` unique, `author_id` → users, xoá user thì xoá bài |
| `tags`, `article_tags` | `Tag`, `Article.tags` | |
| `favorites` | `Article.favoritedBy` | |
| `comments` | `Comment` | xoá bài thì xoá comment (`onDelete: 'CASCADE'`) |

Hai entity import lẫn nhau (User ↔ Article) thì bọc kiểu bằng `Relation<...>` — nếu không, ESM báo `Cannot access 'User' before initialization`.

Đặt tên cột snake_case rõ ràng (`@JoinColumn({ name: 'author_id' })`, `@CreateDateColumn({ name: 'created_at' })`) để SQL dễ đọc.

### 2.3 Một cấu hình, hai nơi dùng
TypeORM CLI chạy **ngoài** Nest, không có DI hay ConfigModule. Để app và CLI không bao giờ lệch nhau:
- `src/database/typeorm.options.ts` — hàm `typeOrmOptions(env)` trả về cấu hình (entities, migrations, `synchronize: false`).
- `app.module.ts` — `TypeOrmModule.forRootAsync({ useFactory: () => typeOrmOptions(process.env) })`.
- `src/database/data-source.ts` — `process.loadEnvFile()` (có sẵn trong Node, không cần `dotenv`) rồi `export default new DataSource(typeOrmOptions(process.env))`.

### 2.4 Lệnh migration
Dự án ESM nên CLI chạy trên bản **đã build** (`dist/`) — các script tự `npm run build` trước:

| Lệnh | Việc làm |
|---|---|
| `npm run migration:generate -- src/database/migrations/<Ten>` | So entity với DB thật, sinh file chứa phần chênh lệch |
| `npm run migration:create -- src/database/migrations/<Ten>` | Tạo file rỗng để tự viết (seed, đổi dữ liệu…) |
| `npm run migration:run` | Chạy các migration chưa chạy |
| `npm run migration:revert` | Hoàn tác migration **gần nhất** (gọi `down()`) |
| `npm run migration:show` | Liệt kê: `[X]` đã chạy, `[ ]` chưa |

TypeORM ghi các migration đã chạy vào bảng `migrations`, nên chạy `migration:run` nhiều lần không sao.

### 2.5 Quy trình mỗi lần đổi schema
```bash
# 1. Sửa entity, ví dụ thêm cột vào User
# 2. Sinh migration (DB phải đang ở trạng thái mới nhất)
npm run migration:generate -- src/database/migrations/AddUserLocale
# 3. ĐỌC file sinh ra — kiểm up() lẫn down()
# 4. Chạy và thử hoàn tác
npm run migration:run
npm run migration:revert && npm run migration:run
# 5. Commit entity + file migration trong cùng một PR
```

Quy tắc:
- **Không sửa migration đã merge/đã chạy ở môi trường khác.** Cần đổi gì thì tạo migration mới.
- `generate` báo *"No changes in database schema"* nghĩa là entity và DB đã khớp — dùng câu này để kiểm tra trước khi tạo PR.
- Đổi tên cột: `generate` sẽ sinh DROP + ADD (mất dữ liệu). Sửa tay thành `RENAME COLUMN`.

Kiểm bằng psql:
```bash
docker compose exec db psql -U realworld -c '\dt'
```

---

## Bước 3 — Đa ngôn ngữ (i18n)

### 3.1 File dịch
`src/i18n/<locale>/<namespace>.json` — tên file là namespace, key gọi là `namespace.key`:
```
src/i18n/en/common.json      {"hello": "Hello, {name}!"}
src/i18n/vi/common.json      {"hello": "Xin chào, {name}!"}
src/i18n/{en,vi}/validation.json   # bản dịch lỗi class-validator
```
JSON không phải TypeScript nên `tsc` không chép sang `dist/` — `nest-cli.json` đã khai báo:
```json
"assets": [{ "include": "i18n/**/*.json", "watchAssets": true }]
```

### 3.2 Đăng ký module
```ts
I18nModule.forRootAsync({
  loader: new JsonI18nLoader({ path: join(import.meta.dirname, 'i18n') }),
  resolvers: [
    new QueryLocaleResolver('lang'),     // ?lang=vi
    new HeaderLocaleResolver('x-lang'),  // x-lang: vi
    new AcceptLanguageLocaleResolver(),  // Accept-Language: vi-VN,vi;q=0.9
  ],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    // Ghi sai (vd. 'fr', chưa có thư mục dịch) thì báo lỗi ngay khi khởi động
    defaultLocale: defaultLocaleFrom(config.get('DEFAULT_LOCALE')),
  }),
})
```
Resolver đầu tiên tìm được ngôn ngữ **có hỗ trợ** sẽ thắng; không tìm được thì dùng `defaultLocale`. Ngôn ngữ hỗ trợ = các thư mục trong `src/i18n/`.

### 3.3 Dịch trong code
```ts
// Trong service/controller — tự lấy ngôn ngữ của request hiện tại
this.i18n.t('common.hello', { args: { name: 'An' } });

// Ném exception có message đã dịch, không cần inject gì
import { t } from '@nestjs/i18n';
throw new NotFoundException(t('articles.notFound'));

// Lấy locale hiện tại trong handler
@Get() find(@CurrentLocale() locale: string) {}
```

### 3.4 Dịch lỗi validation
`src/app.setup.ts` dùng `I18nValidationPipe` thay `ValidationPipe` (kèm `validationExceptionFactory` để trả lỗi 422 dạng `{"errors": {...}}` theo spec) (nhận cùng tuỳ chọn `whitelist`, `transform`…). Constraint nào không có `message` riêng sẽ tra key `validation.<tên-constraint>`:
```json
// src/i18n/vi/validation.json
{ "isLength": "{property} phải dài từ {constraint1} đến {constraint2} ký tự" }
```
Chỉ định key riêng cho một field:
```ts
@IsEmail({}, { message: i18nValidationMessage('users.invalidEmail') })
email: string;
```
Biến dùng được: `{property}`, `{path}`, `{value}`, `{constraint1}`, `{constraint2}`…, `{count}`.

### 3.5 Thử
```bash
curl "localhost:3000/api/ping?name=An"                        # Hello, An!
curl "localhost:3000/api/ping?name=An&lang=vi"                # Xin chào, An!
curl -H "Accept-Language: vi" "localhost:3000/api/ping?name=X"
# {"errors":{"name":["độ dài không đúng (từ 2 đến 30 ký tự)"]}}   (HTTP 422)
npm run test:e2e                                              # 3 test i18n, không cần DB
```

---

## Chia PR theo guideline

Guideline yêu cầu mỗi PR vài trăm dòng trở xuống, một chức năng mỗi PR:

1. **Init code base** — Bước 1 + Bước 3 (project, config, docker, i18n). Đừng commit `.env`, `dist/`, `node_modules/`.
2. **Init model** — Bước 2: entities + `typeorm.options.ts` + `data-source.ts` + migration `InitSchema`.
3. Sau đó mỗi nhóm API một PR: Authentication (JWT) → Users → Profiles/Follow → Articles → Comments → Favorite → Tags.

Trước khi gửi PR:
```bash
npm run lint && npm test && npm run test:e2e
npm run migration:generate -- src/database/migrations/Check   # phải báo "No changes"
```
và chạy **Sunlint** ([hướng dẫn cài](https://coding-standards.sun-asterisk.vn/docs/installation)): fix 100% rule mức *error*, chụp kết quả đính vào comment của PR.

## Bài tập
1. Thêm cột `locale` (mặc định `'en'`) cho `users` bằng một migration mới; thử `revert` rồi `run` lại.
2. Viết migration bằng `migration:create` để seed vài tag mặc định, kiểm `GET /api/tags`.
3. Thêm tiếng Nhật (`src/i18n/ja/`) và kiểm `?lang=ja` hoạt động mà không sửa code.
4. Spec RealWorld trả lỗi dạng `{"errors":{"body":["..."]}}` — viết `ExceptionFilter` chuyển lỗi validation (đã dịch) sang định dạng này.
