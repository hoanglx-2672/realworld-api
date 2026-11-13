import type { User } from './user.entity.js';

/** Hình dạng `User` trong spec (api-response-format.md#users-for-authentication). */
export interface UserView {
  email: string;
  token: string;
  username: string;
  bio: string | null;
  image: string | null;
}

/** Body trả về của các endpoint user: {"user": {...}}. */
export interface UserEnvelope {
  user: UserView;
}

/** Chọn đúng field được phép ra ngoài — không bao giờ trả entity (có password) thẳng. */
export function toUserView(user: User, token: string): UserView {
  return {
    email: user.email,
    token,
    username: user.username,
    bio: user.bio ?? null,
    image: user.image ?? null,
  };
}
