import type { EntityManager } from 'typeorm';

/**
 * Trong `userIds`, những user mà `viewerId` đang follow: một truy vấn `IN (...)` cho cả danh
 * sách (tránh N+1 khi tính `author.following`). Khách hoặc danh sách rỗng → tập rỗng.
 */
export async function followedAmong(
  manager: EntityManager,
  viewerId: number | undefined,
  userIds: number[],
): Promise<Set<number>> {
  if (viewerId === undefined || !userIds.length) return new Set();
  const rows = await manager
    .createQueryBuilder()
    .select('fl.following_id', 'userId')
    .from('follows', 'fl')
    .where('fl.follower_id = :viewerId AND fl.following_id IN (:...userIds)', {
      viewerId,
      userIds: [...new Set(userIds)],
    })
    .getRawMany<{ userId: number }>();
  return new Set(rows.map((r) => Number(r.userId)));
}
