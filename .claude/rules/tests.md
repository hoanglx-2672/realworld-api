---
paths:
  - "test/**/*.ts"
  - "src/**/*.spec.ts"
---

# Tests

- Test trước: viết e2e cho case nghiệm thu (ID trong `docs/features/<f>/research.md`, ví dụ `it('AUTH-03 …')`), chạy thấy fail đúng lý do (404 vì chưa có route), rồi mới code.
- Không sửa test cho qua. Test sai so với spec thì sửa test và ghi lý do vào research.md.
- e2e dùng `createTestApp()` từ `test/support/create-test-app.ts` (cấu hình giống `main.ts`, DB Postgres local thật).
- Dữ liệu duy nhất mỗi lần chạy: hậu tố `uid()` cho username/email/title — không xoá DB giữa các lần chạy.
- Mỗi endpoint có cả case lỗi (401/403/404/409/422), không chỉ đường thành công.
- Helper có tham số mặc định: phân biệt "không gửi" bằng `null`, không bằng `undefined` (truyền `undefined` sẽ lấy giá trị mặc định).
- Phát hiện từ review/QA → thêm test hồi quy (`R-xx`, `QA-<f>-xx`) trước khi sửa.
- Unit test service: thay repository bằng `{ provide: getRepositoryToken(Entity), useValue: { findOne: vi.fn() } }`.
- Không để lại `it.only` / `it.skip`.
