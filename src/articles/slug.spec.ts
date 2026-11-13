import { slugify, uniqueSlug } from './slug.js';

describe('slugify', () => {
  it.each([
    ['How to train your dragon', 'how-to-train-your-dragon'],
    ['Học NestJS từ đầu: Đường đi!', 'hoc-nestjs-tu-dau-duong-di'],
    ['  --Hello,   World--  ', 'hello-world'],
    ['🐉🔥', 'article'],
    ['', 'article'],
  ])('%j → %j', (title, slug) => {
    expect(slugify(title)).toBe(slug);
  });

  it('cắt còn tối đa 80 ký tự, không kết thúc bằng gạch', () => {
    const s = slugify('a '.repeat(100));
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith('-')).toBe(false);
  });
});

describe('uniqueSlug', () => {
  it('thêm hậu tố 6 ký tự, hai lần gọi khác nhau', () => {
    const a = uniqueSlug('Dup title');
    const b = uniqueSlug('Dup title');
    expect(a).toMatch(/^dup-title-[a-z0-9]{6}$/);
    expect(a).not.toBe(b);
  });
});
