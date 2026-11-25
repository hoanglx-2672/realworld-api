import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type SelectQueryBuilder } from 'typeorm';
import { Article } from '../articles/article.entity.js';
import { articleNotFoundException } from '../articles/articles.utils.js';
import { foreignKeyViolationColumn } from '../common/http-errors.js';
import { hasNulChar } from '../common/utils/string.util.js';
import { selectAuthorProfile } from '../profiles/profiles.utils.js';
import { Comment } from './comment.entity.js';
import { toCommentView } from './comment.mapper.js';
import { COMMENT_ARTICLE_FK_COLUMN } from './comments.constants.js';
import type { CommentRow, CommentView } from './comments.types.js';
import {
  commentForbiddenException,
  commentNotFoundException,
  parseCommentId,
} from './comments.utils.js';
import type { CreateCommentDto } from './dto/create-comment.dto.js';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment) private readonly comments: Repository<Comment>,
    @InjectRepository(Article) private readonly articles: Repository<Article>,
  ) {}

  /** POST /articles/:slug/comments */
  async create(
    slug: string,
    userId: number,
    dto: CreateCommentDto,
  ): Promise<CommentView> {
    const articleId = await this.articleIdOrThrow(slug);
    let id: number;
    try {
      ({ id } = await this.comments.save(
        this.comments.create({
          body: dto.body,
          article: { id: articleId },
          author: { id: userId },
        }),
      ));
    } catch (error) {
      // Bài bị xoá giữa lúc tra và lúc ghi → vẫn là 404.
      if (foreignKeyViolationColumn(error) === COMMENT_ARTICLE_FK_COLUMN) {
        throw articleNotFoundException();
      }
      throw error;
    }
    const row = await this.viewQuery(userId)
      .where('comment.id = :id', { id })
      .getRawOne<CommentRow>();
    if (!row) throw articleNotFoundException();
    return toCommentView(row);
  }

  /** GET /articles/:slug/comments — mới nhất trước. */
  async list(slug: string, viewerId?: number): Promise<CommentView[]> {
    const articleId = await this.articleIdOrThrow(slug);
    const rows = await this.viewQuery(viewerId)
      .where('comment.article_id = :articleId', { articleId })
      .orderBy('comment.createdAt', 'DESC')
      .addOrderBy('comment.id', 'DESC')
      .getRawMany<CommentRow>();
    return rows.map(toCommentView);
  }

  /** DELETE /articles/:slug/comments/:id — 404 article → 404 comment → 403 nếu không phải tác giả. */
  async remove(slug: string, rawId: string, userId: number): Promise<void> {
    const articleId = await this.articleIdOrThrow(slug);
    const id = parseCommentId(rawId);
    const comment =
      id === undefined
        ? null
        : await this.comments.findOne({
            select: { id: true, author: { id: true } },
            where: { id, article: { id: articleId } },
            relations: { author: true },
          });
    if (!comment) throw commentNotFoundException();
    if (comment.author.id !== userId) throw commentForbiddenException();
    const { affected } = await this.comments.delete({ id: comment.id });
    if (!affected) throw commentNotFoundException();
  }

  /** Mỗi comment một dòng, đủ trường của spec. */
  private viewQuery(viewerId?: number): SelectQueryBuilder<Comment> {
    const qb = this.comments
      .createQueryBuilder('comment')
      .innerJoin('comment.author', 'author')
      .select('comment.id', 'id')
      .addSelect('comment.createdAt', 'createdAt')
      .addSelect('comment.updatedAt', 'updatedAt')
      .addSelect('comment.body', 'body');
    return selectAuthorProfile(qb, viewerId);
  }

  /** Id của bài theo slug; không có (kể cả slug chứa NUL) → 404 article. */
  private async articleIdOrThrow(slug: string): Promise<number> {
    const article = hasNulChar(slug)
      ? null
      : await this.articles.findOne({ select: { id: true }, where: { slug } });
    if (!article) throw articleNotFoundException();
    return article.id;
  }
}
