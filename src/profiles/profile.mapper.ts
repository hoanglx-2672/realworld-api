import type { User } from '../users/user.entity.js';
import type { Profile } from './profile.types.js';

/** `following`: người đang xem có follow `user` không (khách → false). */
export function toProfile(user: User, following: boolean): Profile {
  return {
    username: user.username,
    bio: user.bio ?? null,
    image: user.image ?? null,
    following,
  };
}
