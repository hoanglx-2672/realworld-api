---
name: qa-test-feature
description: Bước 4/4 của vòng làm một feature RealWorld (research → implement → review → qa). Kiểm thử hộp đen trên app đang chạy — chạy bộ API test chính thức của RealWorld (Hurl) cho feature, rồi thử thêm các case ngoài bộ test (i18n, dữ liệu xấu, đồng thời, token) bằng curl — ghi docs/features/<feature>/qa.md kèm lệnh tái hiện cho mỗi lỗi. Dùng khi user nói "QA feature X", "test thử API", "chạy hurl", "chạy test chính thức realworld", "feature này chạy đúng chưa", "test tay", "kiểm thử trước khi merge".
argument-hint: "<auth|profiles|articles|comments|authorization|favorites|tags|all>"
---

# QA test feature

Khác `implement-feature` (test do mình viết) và `review-feature` (đọc code): bước này **gọi API thật như client**, không nhìn code, để bắt chỗ hiểu sai spec mà chính test của mình cũng sai theo.

## 1. Dựng môi trường

```bash
npm run db:up
npm run migration:run
npm run build && node dist/main.js     # chạy nền; đợi "API: http://...:3000/api"
```
Chạy app ở chế độ build (không phải `start:dev`) để giống môi trường thật. Xong thì tắt app.

## 2. Bộ test chính thức (Hurl)

```bash
node .claude/skills/qa-test-feature/scripts/chay-hurl.mjs <feature>
node .claude/skills/qa-test-feature/scripts/chay-hurl.mjs all      # hồi quy toàn bộ trước khi merge feature cuối
```
- Kết quả ghi vào `docs/features/<feature>/qa-hurl.txt`.
- Máy chưa có Hurl: script dừng và in hai lựa chọn. Hỏi user **một lần**: cài (`winget install Orange-OpenSource.Hurl`) hay chạy qua npx (thêm `--npx`). Không tự chọn.
- Feature phụ thuộc feature khác (bảng trong `docs/realworld-spec/README.md`): test của nó tự đăng ký user, tạo article…, nên các feature trước phải xanh trước.
- Test hỏng: đọc assert trong output (dòng, mong đợi, thực tế), đối chiếu file `.hurl`, phân loại **app sai** hay **môi trường** (app chưa bật, DB chưa migrate). Không sửa file `.hurl`.

## 3. Case ngoài bộ test

Lấy từ mục "Case thêm" trong `docs/features/<feature>/research.md`, cộng các nhóm dưới (chọn cái hợp với feature). Mỗi case là một lệnh curl chạy được, kèm mã và body thực tế.

| Nhóm | Thử |
|---|---|
| i18n | cùng request lỗi với `?lang=vi`, `Accept-Language: vi-VN,vi;q=0.9`, `x-lang: vi` → câu tiếng Việt; không gửi → câu tiếng Anh nguyên văn spec; `?lang=xx` → về `en` |
| Dữ liệu xấu | JSON hỏng; body không bọc key; field sai kiểu (`tagList: "a"`); chuỗi 10.000 ký tự; unicode/emoji trong title (slug vẫn dùng được trong URL); `' OR 1=1 --` trong field/query |
| Phân trang | `limit=0`, `limit=-1`, `limit=1000`, `offset` vượt tổng, `limit=abc` |
| Token | thiếu; `Bearer` thay `Token`; chữ ký sai; hết hạn; token của user đã đổi email |
| Đồng thời | gửi 2 request đăng ký trùng cùng lúc (`& wait`) → một 201, một 409, không có 500 |
| Quyền | user B sửa/xoá đồ của user A → 403 và dữ liệu A còn nguyên (GET lại để chắc) |
| Lộ dữ liệu | không response nào có `password`; lỗi 500 không lộ stack/SQL |

Mọi 500 đều là lỗi, kể cả khi mã mong đợi là 4xx.

## 4. Ghi `docs/features/<feature>/qa.md`

```markdown
# <feature> — QA
Ngày · Commit/diff: <...> · Host: http://localhost:3000

## Bộ test chính thức
<n> request, <pass>/<fail> — chi tiết: qa-hurl.txt

## Case thêm
| ID | Case | Mong đợi | Thực tế | Kết quả |
|---|---|---|---|---|

## Lỗi
### QA-<feature>-01 <tóm tắt>
- Mức: Chặn / Cao / Thấp
- Tái hiện:
  ```bash
  curl -s -X POST localhost:3000/api/... -H 'Content-Type: application/json' -d '...'
  ```
- Mong đợi: ... · Thực tế: ...
- Liên quan case: <ID trong research.md>

## Kết luận
Đạt / Không đạt (lỗi chặn: ...)
```

Báo user: số pass/fail Hurl, số lỗi theo mức, lỗi nào chặn merge. Sửa lỗi là việc của `implement-feature`. Sửa xong thì chạy lại QA cho feature đó.

## Không làm
- Không sửa code hay file `.hurl` trong bước này.
- Không chạy QA trên DB có dữ liệu thật; chỉ DB local trong Docker.
- Không báo "đạt" khi bộ Hurl chưa thực sự chạy (thiếu tool, app chưa bật). Ghi rõ là chưa chạy.
