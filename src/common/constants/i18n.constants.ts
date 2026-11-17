import {
  AcceptLanguageLocaleResolver,
  HeaderLocaleResolver,
  type LocaleResolver,
  QueryLocaleResolver,
} from '@nestjs/i18n';

/** Ngôn ngữ khi `.env` không có DEFAULT_LOCALE. */
export const DEFAULT_LOCALE = 'en';

/** Ngôn ngữ có file dịch: phải khớp các thư mục trong src/i18n/ (có test kiểm). */
export const SUPPORTED_LOCALES: readonly string[] = ['en', 'vi'];

/**
 * Cách chọn ngôn ngữ của request: thử lần lượt, cái nào tìm được ngôn ngữ hỗ trợ trước
 * thì thắng. Dùng chung cho I18nModule (app.module.ts) và AllExceptionsFilter, nên mọi
 * lỗi chọn cùng một ngôn ngữ.
 */
export const LOCALE_RESOLVERS: LocaleResolver[] = [
  new QueryLocaleResolver('lang'), //     ?lang=vi
  new HeaderLocaleResolver('x-lang'), //  x-lang: vi
  new AcceptLanguageLocaleResolver(), //  Accept-Language: vi-VN,vi;q=0.9
];
