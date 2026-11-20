export const USERNAME_MAX_LENGTH = 255;
export const EMAIL_MAX_LENGTH = 255;

/**
 * Mật khẩu: tối thiểu 8 ký tự (NIST 800-63B, bộ test đòi);
 * tối đa 72 **byte** UTF-8 vì bcrypt bỏ qua phần sau byte 72 (đếm ký tự thì "é" lọt).
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX_BYTES = 72;

export const BIO_MAX_LENGTH = 10_000;
export const IMAGE_URL_MAX_LENGTH = 2048;
export const IMAGE_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: false, // cho phép http://localhost:3000/a.png khi dev
};

export const BCRYPT_COST = 10;

/**
 * Hash giả để so khi email không tồn tại: login mất cùng thời gian dù email
 * có hay không, kẻ dò không đoán được email nào đã đăng ký qua thời gian phản hồi.
 * Tính sẵn (cost = BCRYPT_COST, mật khẩu ngẫu nhiên đã bỏ): không chặn event loop lúc import.
 * Đổi BCRYPT_COST thì tạo lại (có unit test kiểm cost khớp):
 *   node -e "import('bcryptjs').then(b => console.log(b.hashSync(crypto.randomUUID(), <cost>)))"
 */
export const DUMMY_HASH =
  '$2b$10$hQdrVIjDsLNzdvTVd0ffwOM7dJ/ORlIrI2ydpUhQ/5JwsfRtUq3dC';

/** Giới hạn login mặc định khi `.env` không đặt LOGIN_THROTTLE_*: 10 lần / 60 giây / IP. */
export const LOGIN_THROTTLE_DEFAULT_LIMIT = 10;
export const LOGIN_THROTTLE_DEFAULT_TTL_MS = 60_000;
