import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
} from '../constants/i18n.constants.js';

/**
 * Ngôn ngữ mặc định lấy từ `.env`. Ghi sai (vd. `fr`, chưa có file dịch) thì app vẫn
 * chạy nhưng mọi câu lỗi thành key thô (`errors.notFound`) → báo lỗi ngay khi khởi động.
 */
export function defaultLocaleFrom(value: string | undefined): string {
  const locale = value?.trim() || DEFAULT_LOCALE;
  if (!SUPPORTED_LOCALES.includes(locale)) {
    throw new Error(
      `DEFAULT_LOCALE="${locale}" chưa có file dịch, chọn một trong: ${SUPPORTED_LOCALES.join(', ')}`,
    );
  }
  return locale;
}
