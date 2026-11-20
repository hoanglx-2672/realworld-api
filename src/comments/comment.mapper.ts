import type { CommentRow, CommentView } from './comments.types.js';

/** Dòng DB → JSON của spec: chỉ đổi ngày sang ISO 8601. */
export function toCommentView(row: CommentRow): CommentView {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    body: row.body,
    author: row.author,
  };
}
