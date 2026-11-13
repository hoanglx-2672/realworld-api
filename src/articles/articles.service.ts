import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, In, Repository } from 'typeorm';
import {
  errorsException,
  uniqueViolationColumn,
} from '../common/http-errors.js';
import { Tag } from '../tags/tag.entity.js';
import { Article } from './article.entity.js';
import {
  type ArticleListItem,
  type ArticleViewerState,
  type ArticleView,
  toArticleListItem,
  toArticleView,
} from './article.mapper.js';
import type { CreateArticleDto } from './dto/create-article.dto.js';
import type { ListArticlesQueryDto } from './dto/list-articles-query.dto.js';
import type { UpdateArticleDto } from './dto/update-article.dto.js';
import { slugify, uniqueSlug } from './slug.js';

/** Một trang danh sách bài, đúng hình dạng spec. */
export interface ArticlePage {
  articles: ArticleListItem[];
  articlesCount: number;
}

/** Số lần thử lại khi hậu tố ngẫu nhiên của slug trùng (gần như không xảy ra). */
const SLUG_ATTEMPTS = 3;

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
    const article = await this.retryOnSlugTaken(() =>
      this.articles.manager.transaction(async (manager) => {
        const draft = manager.create(Article, {
          title: dto.title,
          description: dto.description,
          body: dto.body,
          author: { id: authorId },
          slug: uniqueSlug(dto.title),
          tags: await resolveTags(manager, dto.tagList ?? []),
        });
        return loadForView(manager, (await manager.save(draft)).id);
      }),
    );
    return this.toView(article, authorId);
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
    const updated = await this.retryOnSlugTaken(() =>
      this.articles.manager.transaction(async (manager) => {
        const article = await lockBySlugOrThrow(manager, slug);
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
          article.tags = await resolveTags(manager, dto.tagList);
          // Chỉ đổi tag thì TypeORM chỉ ghi bảng nối, không UPDATE articles →
          // @UpdateDateColumn không chạy. Đặt tay để updatedAt phản ánh lần sửa.
          article.updatedAt = new Date();
        }
        return loadForView(manager, (await manager.save(article)).id);
      }),
    );
    return this.toView(updated, userId);
  }

  /** DELETE /articles/:slug — chỉ tác giả. Comment, tag, favorite đi theo nhờ FK ON DELETE CASCADE. */
  async remove(slug: string, userId: number): Promise<void> {
    const article = await this.findBySlugOrThrow(slug);
    this.assertAuthor(article, userId);
    await this.articles.delete({ id: article.id });
  }

  private assertAuthor(article: Article, userId: number): void {
    if (article.author.id !== userId) {
      throw errorsException(
        HttpStatus.FORBIDDEN,
        'article',
        'errors.forbidden',
      );
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
   * GET /articles — mới nhất trước. Số truy vấn cố định (≈6) bất kể trang dài bao nhiêu:
   * đếm · lấy id của trang · nạp bài + author + tags · 3 truy vấn gộp cho viewer state.
   */
  async list(
    query: ListArticlesQueryDto,
    viewerId?: number,
  ): Promise<ArticlePage> {
    const filtered = this.articles
      .createQueryBuilder('article')
      .innerJoin('article.author', 'author');
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

    const articlesCount = await filtered.getCount();
    const page = await filtered
      .clone()
      .select('article.id')
      .orderBy('article.createdAt', 'DESC')
      .addOrderBy('article.id', 'DESC')
      .offset(query.offset)
      .limit(query.limit)
      .getMany();
    if (!page.length) return { articles: [], articlesCount };

    const ids = page.map((a) => a.id);
    const loaded = await this.articles.find({
      where: { id: In(ids) },
      relations: { author: true, tags: true },
    });
    const byId = new Map(loaded.map((a) => [a.id, a]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((a) => a !== undefined);
    const states = await this.viewerStates(ordered, viewerId);
    return {
      articles: ordered.map((a, i) => toArticleListItem(a, states[i])),
      articlesCount,
    };
  }

  /** GET /articles/:slug — `viewerId` undefined khi khách xem. */
  async findOne(slug: string, viewerId?: number): Promise<ArticleView> {
    return this.toView(await this.findBySlugOrThrow(slug), viewerId);
  }

  private async toView(
    article: Article,
    viewerId?: number,
  ): Promise<ArticleView> {
    const [state] = await this.viewerStates([article], viewerId);
    return toArticleView(article, state);
  }

  private async findBySlugOrThrow(slug: string): Promise<Article> {
    const article = hasNul(slug)
      ? null
      : await this.articles.findOne({
          where: { slug },
          relations: { author: true, tags: true },
        });
    return article ?? throwArticleNotFound();
  }

  /**
   * favorited / favoritesCount / author.following cho nhiều bài bằng 3 truy vấn
   * gộp `IN (...)` — số truy vấn không tăng theo số bài (tránh N+1).
   */
  private async viewerStates(
    list: Article[],
    viewerId?: number,
  ): Promise<ArticleViewerState[]> {
    if (!list.length) return [];
    const ids = list.map((a) => a.id);
    const authorIds = [...new Set(list.map((a) => a.author.id))];
    const qb = () => this.articles.manager.createQueryBuilder();

    const counts = await qb()
      .select('f.article_id', 'articleId')
      .addSelect('COUNT(*)::int', 'count')
      .from('favorites', 'f')
      .where('f.article_id IN (:...ids)', { ids })
      .groupBy('f.article_id')
      .getRawMany<{ articleId: number; count: number }>();
    const countById = new Map(
      counts.map((r) => [Number(r.articleId), r.count]),
    );

    let favorited = new Set<number>();
    let following = new Set<number>();
    if (viewerId !== undefined) {
      const favRows = await qb()
        .select('f.article_id', 'articleId')
        .from('favorites', 'f')
        .where('f.user_id = :viewerId AND f.article_id IN (:...ids)', {
          viewerId,
          ids,
        })
        .getRawMany<{ articleId: number }>();
      favorited = new Set(favRows.map((r) => Number(r.articleId)));

      const followRows = await qb()
        .select('fl.following_id', 'userId')
        .from('follows', 'fl')
        .where(
          'fl.follower_id = :viewerId AND fl.following_id IN (:...authorIds)',
          {
            viewerId,
            authorIds,
          },
        )
        .getRawMany<{ userId: number }>();
      following = new Set(followRows.map((r) => Number(r.userId)));
    }

    return list.map((a) => ({
      favorited: favorited.has(a.id),
      favoritesCount: countById.get(a.id) ?? 0,
      following: following.has(a.author.id),
    }));
  }
}

/** Slug do mình sinh không bao giờ chứa NUL; gửi NUL vào Postgres thì lỗi 22021 → 500. */
const hasNul = (value: string) => value.includes('\u0000');

function throwArticleNotFound(): never {
  throw errorsException(HttpStatus.NOT_FOUND, 'article', 'errors.notFound');
}

/**
 * Đọc lại bài vừa ghi **trong cùng transaction**: đọc sau khi commit thì một DELETE chen
 * vào giữa làm PUT/POST đã ghi thành công vẫn trả 404.
 */
function loadForView(manager: EntityManager, id: number): Promise<Article> {
  return manager.findOneOrFail(Article, {
    where: { id },
    relations: { author: true, tags: true },
  });
}

/**
 * Khoá dòng bài (`SELECT ... FOR UPDATE`) rồi nạp đủ quan hệ. Khoá riêng bằng câu không
 * JOIN vì Postgres không cho FOR UPDATE trên phía nullable của LEFT JOIN.
 */
async function lockBySlugOrThrow(
  manager: EntityManager,
  slug: string,
): Promise<Article> {
  const locked = hasNul(slug)
    ? null
    : await manager
        .createQueryBuilder(Article, 'article')
        .select('article.id')
        .where('article.slug = :slug', { slug })
        .setLock('pessimistic_write')
        .getOne();
  if (!locked) throwArticleNotFound();
  return manager.findOneOrFail(Article, {
    where: { id: locked.id },
    relations: { author: true, tags: true },
  });
}

/**
 * Tag theo tên: tạo tag chưa có rồi đọc lại tất cả, trong transaction của `manager`.
 * `upsert` (INSERT ... ON CONFLICT) để hai request tạo cùng một tag mới cùng lúc
 * không đụng ràng buộc unique.
 */
async function resolveTags(
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
