import { toProfile } from '../profiles/profile.mapper.js';
import type { Comment } from './comment.entity.js';
import type { CommentView } from './comments.types.js';

/** `following`: người đang xem có follow tác giả comment không (khách → false). */
export function toCommentView(
  comment: Comment,
  following: boolean,
): CommentView {
  return {
    id: comment.id,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    body: comment.body,
    author: toProfile(comment.author, following),
  };
}
