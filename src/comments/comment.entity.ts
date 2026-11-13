import { Column, Entity, JoinColumn, ManyToOne, type Relation } from 'typeorm';
import { Article } from '../articles/article.entity.js';
import { BaseEntity } from '../common/base.entity.js';
import { User } from '../users/user.entity.js';

@Entity('comments')
export class Comment extends BaseEntity {
  @Column({ type: 'text' })
  body: string;

  /** Xoá bài viết thì xoá luôn comment của nó. */
  @ManyToOne(() => Article, (article) => article.comments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'article_id' })
  article: Relation<Article>;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: Relation<User>;
}
