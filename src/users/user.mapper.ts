import type { User } from './user.entity.js';
import type { UserView } from './user.types.js';

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
