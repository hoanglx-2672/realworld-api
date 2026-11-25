import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { AUTHOR_PROFILE_SQL } from './profiles.constants.js';

/** Thêm cột `author` (Profile) cho query đã join user với alias `author`. */
export const selectAuthorProfile = <T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  viewerId?: number,
): SelectQueryBuilder<T> =>
  qb
    .addSelect(AUTHOR_PROFILE_SQL, 'author')
    .setParameter('viewerId', viewerId ?? null);
