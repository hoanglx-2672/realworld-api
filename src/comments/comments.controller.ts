import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CommentsService } from './comments.service.js';
import type { CommentEnvelope, CommentsEnvelope } from './comments.types.js';
import { CreateCommentRequestDto } from './dto/create-comment.dto.js';

@Controller('articles/:slug/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  // POST /api/articles/:slug/comments → 201
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Param('slug') slug: string,
    @CurrentAuth() auth: AuthContext,
    @Body() body: CreateCommentRequestDto,
  ): Promise<CommentEnvelope> {
    return {
      comment: await this.commentsService.create(
        slug,
        auth.userId,
        body.comment,
      ),
    };
  }

  // GET /api/articles/:slug/comments — khách xem được; có token thì tính author.following
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async list(
    @Param('slug') slug: string,
    @CurrentAuth() auth?: AuthContext,
  ): Promise<CommentsEnvelope> {
    return { comments: await this.commentsService.list(slug, auth?.userId) };
  }

  // DELETE /api/articles/:slug/comments/:id → 204; chỉ tác giả comment (người khác → 403)
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<void> {
    return this.commentsService.remove(slug, id, auth.userId);
  }
}
