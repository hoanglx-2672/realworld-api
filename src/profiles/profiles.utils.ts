/** SQL dựng Profile của user alias `alias`; `following` theo `:viewerId` (NULL → false). */
export const profileJson = (alias: string): string =>
  `json_build_object(
    'username', ${alias}.username, 'bio', ${alias}.bio, 'image', ${alias}.image,
    'following', EXISTS (SELECT 1 FROM follows fl
      WHERE fl.follower_id = :viewerId AND fl.following_id = ${alias}.id))`;
