import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/** Profile của user join với alias `author`; `following` theo `:viewerId` (NULL → false). */
const AUTHOR_PROFILE_SQL = `json_build_object(
  'username', author.username, 'bio', author.bio, 'image', author.image,
  'following', EXISTS (SELECT 1 FROM follows fl
    WHERE fl.follower_id = :viewerId AND fl.following_id = author.id))`;

/** Thêm cột `author` (Profile) cho query đã join user với alias `author`. */
export const selectAuthorProfile = <T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  viewerId?: number,
): SelectQueryBuilder<T> =>
  qb
    .addSelect(AUTHOR_PROFILE_SQL, 'author')
    .setParameter('viewerId', viewerId ?? null);
