import type { Profile } from '../profiles/profile.types.js';

/** Hình dạng `Comment` trong spec (api-response-format.md#single-comment). */
export interface CommentView {
  id: number;
  createdAt: string;
  updatedAt: string;
  body: string;
  author: Profile;
}

/** Một comment như DB trả về (viewQuery); chỉ ngày còn là Date. */
export interface CommentRow extends Omit<
  CommentView,
  'createdAt' | 'updatedAt'
> {
  createdAt: Date;
  updatedAt: Date;
}

/** Body trả về của POST /articles/:slug/comments: {"comment": {...}}. */
export interface CommentEnvelope {
  comment: CommentView;
}

/** Body trả về của GET /articles/:slug/comments: {"comments": [...]}. */
export interface CommentsEnvelope {
  comments: CommentView[];
}
