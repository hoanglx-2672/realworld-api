import { parseExpiresIn } from './auth.module.js';

describe('parseExpiresIn', () => {
  it('chuỗi toàn số → số giây (không phải mili giây)', () => {
    expect(parseExpiresIn('3600')).toBe(3600);
  });
  it('chuỗi có đơn vị → giữ nguyên', () => {
    expect(parseExpiresIn('7d')).toBe('7d');
    expect(parseExpiresIn('12h')).toBe('12h');
  });
});
