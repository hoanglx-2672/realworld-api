/** Email không phân biệt hoa thường: `Jake@x.com` và `jake@x.com` là một người. */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
