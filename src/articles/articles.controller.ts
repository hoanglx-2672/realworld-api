import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import {
  type AuthContext,
  JwtAuthGuard,
  OptionalJwtAuthGuard,
} from '../auth/jwt-auth.guard.js';
import type { ArticleView } from './article.mapper.js';
import { type ArticlePage, ArticlesService } from './articles.service.js';
import { CreateArticleRequestDto } from './dto/create-article.dto.js';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto.js';
import { UpdateArticleRequestDto } from './dto/update-article.dto.js';

/** Body trả về của các endpoint một bài: {"article": {...}}. */
interface ArticleEnvelope {
  article: ArticleView;
}

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  // POST /api/articles → 201
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CreateArticleRequestDto,
  ): Promise<ArticleEnvelope> {
    return {
      article: await this.articlesService.create(auth.userId, body.article),
    };
  }

  // GET /api/articles?tag=&author=&favorited=&limit=&offset= — khách xem được
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(
    @Query() query: ListArticlesQueryDto,
    @CurrentAuth() auth?: AuthContext,
  ): Promise<ArticlePage> {
    return this.articlesService.list(query, auth?.userId);
  }

  // GET /api/articles/:slug — khách xem được; có token thì tính favorited/following
  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(
    @Param('slug') slug: string,
    @CurrentAuth() auth?: AuthContext,
  ): Promise<ArticleEnvelope> {
    return { article: await this.articlesService.findOne(slug, auth?.userId) };
  }

  // PUT /api/articles/:slug — chỉ tác giả (người khác → 403)
  @Put(':slug')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('slug') slug: string,
    @CurrentAuth() auth: AuthContext,
    @Body() body: UpdateArticleRequestDto,
  ): Promise<ArticleEnvelope> {
    return {
      article: await this.articlesService.update(
        slug,
        auth.userId,
        body.article,
      ),
    };
  }

  // DELETE /api/articles/:slug → 204 (không có body)
  @Delete(':slug')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('slug') slug: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<void> {
    return this.articlesService.remove(slug, auth.userId);
  }
}
