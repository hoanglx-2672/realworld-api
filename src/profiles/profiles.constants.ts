/** SQL dựng Profile của user join với alias `author`; `following` theo `:viewerId` (NULL → false). */
export const AUTHOR_PROFILE_SQL = `json_build_object(
  'username', author.username, 'bio', author.bio, 'image', author.image,
  'following', EXISTS (SELECT 1 FROM follows fl
    WHERE fl.follower_id = :viewerId AND fl.following_id = author.id))`;
