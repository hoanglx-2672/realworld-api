import type { Profile } from '../profiles/profile.types.js';

/** Thông tin phụ thuộc người đang xem, tính bằng truy vấn gộp (ArticlesService.viewerStates). */
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

/** Một trang danh sách bài, đúng hình dạng spec. */
export interface ArticlePage {
  articles: ArticleListItem[];
  articlesCount: number;
}

/** Body trả về của các endpoint một bài: {"article": {...}}. */
export interface ArticleEnvelope {
  article: ArticleView;
}
