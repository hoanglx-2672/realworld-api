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

  /**
   * POST /articles. Tag và bài nằm chung một transaction: lưu bài lỗi thì tag
   * vừa tạo cũng bị huỷ, không để lại tag mồ côi trong GET /tags.
   */
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

  /**
   * PUT /articles/:slug — chỉ tác giả; đổi title thì slug đổi theo (spec).
   * Khoá dòng bài trong transaction: DELETE chạy cùng lúc phải chờ, và nếu DELETE
   * xong trước thì ở đây không còn thấy bài → 404 (trước đây `save` INSERT lại bài đã xoá).
   */
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
          // Chỉ đổi slug khi phần chữ đổi: "Hello world" → "Hello, world!" cùng gốc
          // "hello-world" → giữ slug cũ, link đã chia sẻ không chết.
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
          // Chỉ đổi tag thì TypeORM chỉ ghi bảng nối, không UPDATE articles →
          // @UpdateDateColumn không chạy. Đặt bằng đồng hồ của DB (như created_at),
          // không dùng new Date() của app: hai đồng hồ lệch nhau thì updatedAt có thể
          // nhỏ hơn createdAt (nghi là nguyên nhân ISS-27).
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

  /** DELETE /articles/:slug — chỉ tác giả. Comment, tag, favorite đi theo nhờ FK ON DELETE CASCADE. */
  async remove(slug: string, userId: number): Promise<void> {
    const article = await this.findBySlugOrThrow(slug);
    this.assertAuthor(article, userId);
    await this.articles.delete({ id: article.id });
  }

  private assertAuthor(article: Article, userId: number): void {
    if (article.author.id !== userId) {
      throw articleForbiddenException();
    }
  }

  /**
   * Chạy lại cả transaction khi hậu tố ngẫu nhiên của slug trùng (gần như không xảy ra).
   * Phải chạy lại cả transaction: trong Postgres, một câu lỗi làm hỏng cả transaction đang mở.
   */
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
   * GET /articles — mới nhất trước. Hai truy vấn chạy song song: đếm tổng, và lấy trang.
   * `viewQuery` trả mỗi bài đúng một dòng nên LIMIT/OFFSET chạy thẳng trên câu đó.
   */
  async list(
    query: ListArticlesQueryDto,
    viewerId?: number,
  ): Promise<ArticlePage> {
    const filtered = this.viewQuery(this.articles.manager, viewerId);
    if (query.author) {
      filtered.andWhere('author.username = :author', { author: query.author });
    }
    // Mỗi join lọc khớp tối đa một dòng (tag.name, user.username đều unique)
    // → không nhân bản bài, OFFSET/LIMIT vẫn đúng mà không cần DISTINCT.
    if (query.tag) {
      filtered.innerJoin('article.tags', 'filterTag', 'filterTag.name = :tag', {
        tag: query.tag,
      });
    }
    if (query.favorited) {
      filtered.innerJoin('article.favoritedBy', 'fan', 'fan.username = :fan', {
        fan: query.favorited,
      });
    }

    const [articlesCount, rows] = await Promise.all([
      filtered.getCount(),
      filtered
        .clone()
        .orderBy('article.createdAt', 'DESC')
        .addOrderBy('article.id', 'DESC')
        .offset(query.offset)
        .limit(query.limit)
        .getRawMany<ArticleRow>(),
    ]);
    return { articles: rows.map(toArticleListItem), articlesCount };
  }

  /** GET /articles/:slug — `viewerId` undefined khi khách xem. */
  async findOne(slug: string, viewerId?: number): Promise<ArticleView> {
    if (hasNulChar(slug)) throw articleNotFoundException();
    return this.viewOrThrow(this.articles.manager, { slug }, viewerId);
  }

  /**
   * Câu SELECT trả mỗi bài một dòng, đủ trường của spec — DB tính hết, JS chỉ đổi ngày sang ISO:
   *  - tagList: tên tag đã sắp (COLLATE "C", cùng thứ tự với GET /tags);
   *  - favoritesCount, favorited, author.following: truy vấn con chạy trên khoá chính của
   *    favorites / follows, chỉ cho các dòng của trang.
   * Khách: `:viewerId` = NULL → `= NULL` không bao giờ đúng → favorited / following = false.
   * Chỉ join author (mỗi bài một tác giả) nên không nhân bản dòng.
   */
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

  /**
   * Một bài (có body) theo `id` hoặc `slug`; không có → 404. POST/PUT gọi với `manager` của
   * transaction: đọc sau khi commit thì một DELETE chen vào giữa làm request đã ghi xong vẫn 404.
   */
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

  /** Bài theo slug kèm author (đủ để kiểm quyền, không nạp tags); không có → 404. */
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

  /**
   * Khoá dòng bài (`SELECT ... FOR UPDATE`) rồi nạp đủ quan hệ. Khoá riêng bằng câu không
   * JOIN vì Postgres không cho FOR UPDATE trên phía nullable của LEFT JOIN.
   */
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

  /**
   * Tag theo tên: tạo tag chưa có rồi đọc lại tất cả, trong transaction của `manager`.
   * `upsert` (INSERT ... ON CONFLICT) để hai request tạo cùng một tag mới cùng lúc
   * không đụng ràng buộc unique.
   */
  private async resolveTags(
    manager: EntityManager,
    names: string[],
  ): Promise<Tag[]> {
    // Sắp xếp: mọi request khoá các dòng tag theo cùng một thứ tự → tránh deadlock
    // khi hai request đồng thời tạo cùng các tag mới theo thứ tự ngược nhau.
    const unique = [...new Set(names)].sort();
    if (!unique.length) return [];
    const tags = manager.getRepository(Tag);
    await tags.upsert(
      unique.map((name) => ({ name })),
      { conflictPaths: ['name'], skipUpdateIfNoValuesChanged: true },
    );
    return tags.findBy({ name: In(unique) });
  }
}
