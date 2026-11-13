import { type Profile, toProfile } from '../profiles/profile.mapper.js';
import type { Article } from './article.entity.js';

/** Thông tin phụ thuộc người đang xem, tính bằng truy vấn gộp (xem ArticlesService.present). */
export interface ArticleViewerState {
  favorited: boolean;
  favoritesCount: number;
  following: boolean;
}

/** Phần tử trong danh sách: spec không có `body`. */
export interface ArticleListItem {
  slug: string;
  title: string;
  description: string;
  tagList: string[];
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  favoritesCount: number;
  author: Profile;
}

export interface ArticleView extends ArticleListItem {
  body: string;
}

/** Tag sắp alphabet: spec không quy định thứ tự, alphabet ổn định giữa các lần đọc. */
const sortedTagNames = (article: Article) =>
  (article.tags ?? [])
    .map((t) => t.name)
    .sort(); // so theo mã UTF-16, khớp ORDER BY ... COLLATE "C" của GET /tags

export function toArticleListItem(
  article: Article,
  state: ArticleViewerState,
): ArticleListItem {
  return {
    slug: article.slug,
    title: article.title,
    description: article.description,
    tagList: sortedTagNames(article),
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
    favorited: state.favorited,
    favoritesCount: state.favoritesCount,
    author: toProfile(article.author, state.following),
  };
}

export function toArticleView(
  article: Article,
  state: ArticleViewerState,
): ArticleView {
  return { ...toArticleListItem(article, state), body: article.body };
}
