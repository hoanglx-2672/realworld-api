import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
} from '../constants/i18n.constants.js';
import { defaultLocaleFrom } from './i18n.util.js';

describe('defaultLocaleFrom', () => {
  it.each([undefined, '', '  '])('bỏ trống (%p) → %s', (value) => {
    expect(defaultLocaleFrom(value)).toBe(DEFAULT_LOCALE);
  });

  it('ngôn ngữ có file dịch → giữ nguyên', () => {
    expect(defaultLocaleFrom(' vi ')).toBe('vi');
  });

  it('ngôn ngữ chưa có file dịch → báo lỗi', () => {
    expect(() => defaultLocaleFrom('fr')).toThrow('DEFAULT_LOCALE="fr"');
  });
});

describe('SUPPORTED_LOCALES', () => {
  it('khớp các thư mục trong src/i18n/', () => {
    const dirs = readdirSync(join(import.meta.dirname, '../../i18n'), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect([...SUPPORTED_LOCALES].sort()).toEqual(dirs.sort());
  });
});
