import type {
  ArticleListItem,
  ArticleRow,
  ArticleView,
  ArticleViewRow,
} from './articles.types.js';

/** Dòng DB (đã đủ trường) → JSON của spec: chỉ đổi ngày sang chuỗi ISO 8601. */
export function toArticleListItem(row: ArticleRow): ArticleListItem {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    tagList: row.tagList,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    favorited: row.favorited,
    favoritesCount: row.favoritesCount,
    author: row.author,
  };
}

export function toArticleView(row: ArticleViewRow): ArticleView {
  return { ...toArticleListItem(row), body: row.body };
}
