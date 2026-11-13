import type { User } from '../users/user.entity.js';

/** Hình dạng `Profile` trong spec (api-response-format.md#profile). */
export interface Profile {
  username: string;
  bio: string | null;
  image: string | null;
  following: boolean;
}

/** `following`: người đang xem có follow `user` không (khách → false). */
export function toProfile(user: User, following: boolean): Profile {
  return {
    username: user.username,
    bio: user.bio ?? null,
    image: user.image ?? null,
    following,
  };
}
