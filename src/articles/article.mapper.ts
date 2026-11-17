import { toProfile } from '../profiles/profile.mapper.js';
import type { Article } from './article.entity.js';
import type {
  ArticleListItem,
  ArticleView,
  ArticleViewerState,
} from './articles.types.js';
import { sortedTagNames } from './articles.utils.js';

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
