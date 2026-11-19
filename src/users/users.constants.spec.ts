import { getRounds } from 'bcryptjs';
import { BCRYPT_COST, DUMMY_HASH } from './users.constants.js';

describe('DUMMY_HASH', () => {
  it('cùng cost với BCRYPT_COST (đổi cost thì phải tạo lại hash)', () => {
    // Lệch cost → login với email không tồn tại nhanh/chậm hơn email có thật,
    // kẻ dò đoán được email nào đã đăng ký qua thời gian phản hồi.
    expect(getRounds(DUMMY_HASH)).toBe(BCRYPT_COST);
  });
});
