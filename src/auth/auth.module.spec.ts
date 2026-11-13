import { parseExpiresIn, requireSecret } from './auth.module.js';

describe('parseExpiresIn', () => {
  it('chuỗi toàn số → số giây (không phải mili giây)', () => {
    expect(parseExpiresIn('3600')).toBe(3600);
  });
  it('chuỗi có đơn vị → giữ nguyên', () => {
    expect(parseExpiresIn('7d')).toBe('7d');
    expect(parseExpiresIn('12h')).toBe('12h');
  });
  it.each([undefined, '', '   '])('%j (thiếu / rỗng) → mặc định 7d', (v) => {
    expect(parseExpiresIn(v)).toBe('7d');
  });
  it.each(['seven days', '7x', '-1'])(
    '%j sai định dạng → lỗi lúc khởi động',
    (v) => {
      expect(() => parseExpiresIn(v)).toThrow(/JWT_EXPIRES_IN/);
    },
  );
});

describe('requireSecret', () => {
  it.each([undefined, '', '  '])('%j → lỗi lúc khởi động', (v) => {
    expect(() => requireSecret(v)).toThrow(/JWT_SECRET/);
  });
  it('có giá trị → trả nguyên', () => {
    expect(requireSecret('s3cret')).toBe('s3cret');
  });
});
