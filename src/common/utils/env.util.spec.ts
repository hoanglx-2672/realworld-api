import { positiveInt } from './env.util.js';

describe('positiveInt', () => {
  it.each([undefined, '', '  '])('%j → giá trị mặc định', (v) => {
    expect(positiveInt('X', v, 10)).toBe(10);
  });
  it('"25" → 25', () => {
    expect(positiveInt('X', '25', 10)).toBe(25);
  });
  it.each(['0', '-3', 'ten', '1.5'])('%j → lỗi lúc khởi động', (v) => {
    expect(() => positiveInt('LOGIN_THROTTLE_LIMIT', v, 10)).toThrow(
      /LOGIN_THROTTLE_LIMIT/,
    );
  });
});
