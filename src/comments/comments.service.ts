import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from '../articles/article.entity.js';
import { articleNotFoundException } from '../articles/articles.utils.js';
import { foreignKeyViolationColumn } from '../common/http-errors.js';
import { hasNulChar } from '../common/utils/string.util.js';
import { followedAmong } from '../profiles/profiles.utils.js';
import { User } from '../users/user.entity.js';
import { Comment } from './comment.entity.js';
import { toCommentView } from './comment.mapper.js';
import { COMMENT_ARTICLE_FK_COLUMN } from './comments.constants.js';
import type { CommentView } from './comments.types.js';
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
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** POST /articles/:slug/comments */
  async create(
    slug: string,
    userId: number,
    dto: CreateCommentDto,
  ): Promise<CommentView> {
    const articleId = await this.articleIdOrThrow(slug);
    let comment: Comment;
    try {
      comment = await this.comments.save(
        this.comments.create({
          body: dto.body,
          article: { id: articleId },
          author: { id: userId },
        }),
      );
    } catch (error) {
      // Bài bị xoá giữa lúc tra và lúc ghi → khoá ngoại article_id báo lỗi: vẫn là 404.
      if (foreignKeyViolationColumn(error) === COMMENT_ARTICLE_FK_COLUMN) {
        throw articleNotFoundException();
      }
      throw error;
    }
    comment.author = await this.users.findOneByOrFail({ id: userId });
    const following = await followedAmong(this.comments.manager, userId, [
      userId,
    ]);
    return toCommentView(comment, following.has(userId));
  }

  /** GET /articles/:slug/comments — mới nhất trước; `viewerId` undefined khi khách xem. */
  async list(slug: string, viewerId?: number): Promise<CommentView[]> {
    const articleId = await this.articleIdOrThrow(slug);
    const list = await this.comments.find({
      where: { article: { id: articleId } },
      relations: { author: true },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    // author.following cho cả danh sách bằng một truy vấn (tránh N+1).
    const following = await followedAmong(
      this.comments.manager,
      viewerId,
      list.map((c) => c.author.id),
    );
    return list.map((c) => toCommentView(c, following.has(c.author.id)));
  }

  /**
   * DELETE /articles/:slug/comments/:id — kiểm bài trước (404 article), rồi comment phải
   * thuộc đúng bài đó (404 comment), rồi chỉ tác giả comment được xoá (403). Chủ bài cũng
   * không xoá được comment của người khác.
   */
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
    await this.comments.delete({ id: comment.id });
  }

  /** Id của bài theo slug; không có (kể cả slug chứa NUL, ISS-29) → 404 article. */
  private async articleIdOrThrow(slug: string): Promise<number> {
    const article = hasNulChar(slug)
      ? null
      : await this.articles.findOne({ select: { id: true }, where: { slug } });
    if (!article) throw articleNotFoundException();
    return article.id;
  }
}
