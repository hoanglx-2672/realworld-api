import type { Profile } from '../profiles/profile.types.js';

/**
 * Một bài như DB trả về (ArticlesService.viewQuery): đã đủ trường của spec, kể cả tagList
 * đã sắp và author dạng Profile; chỉ còn ngày là Date.
 */
export interface ArticleRow {
  slug: string;
  title: string;
  description: string;
  tagList: string[];
  createdAt: Date;
  updatedAt: Date;
  favorited: boolean;
  favoritesCount: number;
  author: Profile;
}

/** Dòng của một bài khi xem chi tiết: thêm body. */
export interface ArticleViewRow extends ArticleRow {
  body: string;
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

/** Một trang danh sách bài, đúng hình dạng spec. */
export interface ArticlePage {
  articles: ArticleListItem[];
  articlesCount: number;
}

/** Body trả về của các endpoint một bài: {"article": {...}}. */
export interface ArticleEnvelope {
  article: ArticleView;
}
