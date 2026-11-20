import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type EntityManager,
  In,
  Repository,
  type SelectQueryBuilder,
} from 'typeorm';
import { uniqueViolationColumn } from '../common/http-errors.js';
import { hasNulChar } from '../common/utils/string.util.js';
import { Tag } from '../tags/tag.entity.js';
import { Article } from './article.entity.js';
import { toArticleListItem, toArticleView } from './article.mapper.js';
import { ARTICLE_EDIT_RELATIONS, SLUG_ATTEMPTS } from './articles.constants.js';
import type {
  ArticlePage,
  ArticleRow,
  ArticleView,
  ArticleViewRow,
} from './articles.types.js';
import {
  articleForbiddenException,
  articleNotFoundException,
  orderNewestFirst,
} from './articles.utils.js';
import type { CreateArticleDto } from './dto/create-article.dto.js';
import type { ListArticlesQueryDto } from './dto/list-articles-query.dto.js';
import type { UpdateArticleDto } from './dto/update-article.dto.js';
import { slugify, uniqueSlug } from './slug.js';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article) private readonly articles: Repository<Article>,
  ) {}

  /** POST /articles. Chung transaction với tag để không sót tag mồ côi. */
  async create(authorId: number, dto: CreateArticleDto): Promise<ArticleView> {
    return this.retryOnSlugTaken(() =>
      this.articles.manager.transaction(async (manager) => {
        const draft = manager.create(Article, {
          title: dto.title,
          description: dto.description,
          body: dto.body,
          author: { id: authorId },
          slug: uniqueSlug(dto.title),
          tags: await this.resolveTags(manager, dto.tagList ?? []),
        });
        const { id } = await manager.save(draft);
        return this.viewOrThrow(manager, { id }, authorId);
      }),
    );
  }

  /** PUT /articles/:slug — chỉ tác giả. Khoá dòng để bài vừa bị xoá không "sống lại". */
  async update(
    slug: string,
    userId: number,
    dto: UpdateArticleDto,
  ): Promise<ArticleView> {
    return this.retryOnSlugTaken(() =>
      this.articles.manager.transaction(async (manager) => {
        const article = await this.lockBySlugOrThrow(manager, slug);
        this.assertAuthor(article, userId);

        if (dto.title !== undefined && dto.title !== article.title) {
          // Phần chữ không đổi thì giữ slug cũ để link đã chia sẻ không chết.
          if (slugify(dto.title) !== slugify(article.title)) {
            article.slug = uniqueSlug(dto.title);
          }
          article.title = dto.title;
        }
        if (dto.description !== undefined) {
          article.description = dto.description;
        }
        if (dto.body !== undefined) article.body = dto.body;
        if (dto.tagList !== undefined) {
          article.tags = await this.resolveTags(manager, dto.tagList);
        }
        const { id } = await manager.save(article);
        if (dto.tagList !== undefined) {
          // Chỉ đổi tag thì TypeORM không UPDATE articles; lấy giờ của DB như created_at.
          await manager
            .createQueryBuilder()
            .update(Article)
            .set({ updatedAt: () => 'CURRENT_TIMESTAMP' })
            .where('id = :id', { id })
            .execute();
        }
        return this.viewOrThrow(manager, { id }, userId);
      }),
    );
  }

  /** DELETE /articles/:slug — chỉ tác giả. Xoá 0 dòng (DELETE khác xoá trước) → 404. */
  async remove(slug: string, userId: number): Promise<void> {
    const article = await this.findBySlugOrThrow(slug);
    this.assertAuthor(article, userId);
    const { affected } = await this.articles.delete({ id: article.id });
    if (!affected) throw articleNotFoundException();
  }

  private assertAuthor(article: Article, userId: number): void {
    if (article.author.id !== userId) {
      throw articleForbiddenException();
    }
  }

  /** Hậu tố ngẫu nhiên của slug trùng (hiếm) → chạy lại cả transaction. */
  private async retryOnSlugTaken<T>(work: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await work();
      } catch (error) {
        const isSlugTaken = uniqueViolationColumn(error) === 'slug';
        if (!isSlugTaken || attempt >= SLUG_ATTEMPTS) throw error;
      }
    }
  }

  /**
   * GET /articles — mới nhất trước. Lọc id của trang trước để viewQuery chỉ tính cho
   * các dòng của trang, không tính cho dòng OFFSET bỏ qua.
   */
  async list(
    query: ListArticlesQueryDto,
    viewerId?: number,
  ): Promise<ArticlePage> {
    const matching = this.articles
      .createQueryBuilder('article')
      .innerJoin('article.author', 'author');
    if (query.author) {
      matching.andWhere('author.username = :author', { author: query.author });
    }
    // tag.name, user.username unique → join lọc không nhân bản bài.
    if (query.tag) {
      matching.innerJoin('article.tags', 'filterTag', 'filterTag.name = :tag', {
        tag: query.tag,
      });
    }
    if (query.favorited) {
      matching.innerJoin('article.favoritedBy', 'fan', 'fan.username = :fan', {
        fan: query.favorited,
      });
    }
    const pageIds = orderNewestFirst(matching.clone().select('article.id'))
      .offset(query.offset)
      .limit(query.limit);

    const [articlesCount, rows] = await Promise.all([
      matching.getCount(),
      orderNewestFirst(
        this.viewQuery(this.articles.manager, viewerId).where(
          `article.id IN (${pageIds.getQuery()})`,
          pageIds.getParameters(),
        ),
      ).getRawMany<ArticleRow>(),
    ]);
    return { articles: rows.map(toArticleListItem), articlesCount };
  }

  /** GET /articles/:slug — `viewerId` undefined khi khách xem. */
  async findOne(slug: string, viewerId?: number): Promise<ArticleView> {
    if (hasNulChar(slug)) throw articleNotFoundException();
    return this.viewOrThrow(this.articles.manager, { slug }, viewerId);
  }

  /** Mỗi bài một dòng, đủ trường của spec. Khách: viewerId NULL → favorited/following false. */
  private viewQuery(
    manager: EntityManager,
    viewerId?: number,
  ): SelectQueryBuilder<Article> {
    return manager
      .createQueryBuilder(Article, 'article')
      .innerJoin('article.author', 'author')
      .select('article.slug', 'slug')
      .addSelect('article.title', 'title')
      .addSelect('article.description', 'description')
      .addSelect(
        `ARRAY(SELECT t.name FROM article_tags jt JOIN tags t ON t.id = jt.tag_id
          WHERE jt.article_id = article.id ORDER BY t.name COLLATE "C")`,
        'tagList',
      )
      .addSelect('article.createdAt', 'createdAt')
      .addSelect('article.updatedAt', 'updatedAt')
      .addSelect(
        `EXISTS (SELECT 1 FROM favorites f
          WHERE f.article_id = article.id AND f.user_id = :viewerId)`,
        'favorited',
      )
      .addSelect(
        '(SELECT COUNT(*)::int FROM favorites f WHERE f.article_id = article.id)',
        'favoritesCount',
      )
      .addSelect(
        `json_build_object(
          'username', author.username, 'bio', author.bio, 'image', author.image,
          'following', EXISTS (SELECT 1 FROM follows fl
            WHERE fl.follower_id = :viewerId AND fl.following_id = author.id))`,
        'author',
      )
      .setParameter('viewerId', viewerId ?? null);
  }

  /** Một bài có body; không có → 404. POST/PUT đọc trong transaction của mình. */
  private async viewOrThrow(
    manager: EntityManager,
    where: Pick<Article, 'id'> | Pick<Article, 'slug'>,
    viewerId?: number,
  ): Promise<ArticleView> {
    const row = await this.viewQuery(manager, viewerId)
      .addSelect('article.body', 'body')
      .where(where)
      .getRawOne<ArticleViewRow>();
    if (!row) throw articleNotFoundException();
    return toArticleView(row);
  }

  /** Bài kèm author để kiểm quyền; không có → 404. */
  private async findBySlugOrThrow(slug: string): Promise<Article> {
    const article = hasNulChar(slug)
      ? null
      : await this.articles.findOne({
          where: { slug },
          relations: { author: true },
        });
    if (!article) throw articleNotFoundException();
    return article;
  }

  /** Khoá dòng bằng câu không JOIN (Postgres cấm FOR UPDATE trên LEFT JOIN), rồi nạp quan hệ. */
  private async lockBySlugOrThrow(
    manager: EntityManager,
    slug: string,
  ): Promise<Article> {
    const locked = hasNulChar(slug)
      ? null
      : await manager
          .createQueryBuilder(Article, 'article')
          .select('article.id')
          .where('article.slug = :slug', { slug })
          .setLock('pessimistic_write')
          .getOne();
    if (!locked) throw articleNotFoundException();
    return manager.findOneOrFail(Article, {
      where: { id: locked.id },
      relations: ARTICLE_EDIT_RELATIONS,
    });
  }

  /** Tạo tag chưa có rồi đọc lại. DO NOTHING (không phải upsert) để không khoá tag đã có. */
  private async resolveTags(
    manager: EntityManager,
    names: string[],
  ): Promise<Tag[]> {
    // Chèn theo cùng thứ tự → không deadlock giữa hai request tạo cùng tag mới.
    const unique = [...new Set(names)].sort();
    if (!unique.length) return [];
    await manager
      .createQueryBuilder()
      .insert()
      .into(Tag)
      .values(unique.map((name) => ({ name })))
      .orIgnore()
      .execute();
    return manager.findBy(Tag, { name: In(unique) });
  }
}
