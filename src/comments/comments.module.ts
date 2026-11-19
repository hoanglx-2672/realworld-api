import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from '../articles/article.entity.js';
import { AuthModule } from '../auth/auth.module.js';
import { Comment } from './comment.entity.js';
import { CommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';

// Repository<User> lấy từ AuthModule (đã export TypeOrmModule), không forFeature lại.
@Module({
  imports: [TypeOrmModule.forFeature([Comment, Article]), AuthModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
