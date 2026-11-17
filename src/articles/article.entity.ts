import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  type Relation,
} from 'typeorm';
import { Comment } from '../comments/comment.entity.js';
import { BaseEntity } from '../common/base.entity.js';
import { Tag } from '../tags/tag.entity.js';
import { User } from '../users/user.entity.js';

@Entity('articles')
// Postgres không tự tạo index cho khoá ngoại: lọc ?author= cần index author_id.
@Index('IDX_articles_author_id', ['author'])
// Danh sách sắp "mới nhất trước".
@Index('IDX_articles_created_at', ['createdAt'])
export class Article extends BaseEntity {
  /** Sinh từ title, ví dụ "how-to-train-your-dragon". Dùng trong URL /api/articles/:slug. */
  @Column({ unique: true })
  slug: string;

  @Column()
  title: string;

  @Column({ default: '' })
  description: string;

  @Column({ type: 'text' })
  body: string;

  @ManyToOne(() => User, (user) => user.articles, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'author_id' })
  author: Relation<User>;

  @ManyToMany(() => Tag, (tag) => tag.articles)
  @JoinTable({
    name: 'article_tags',
    joinColumn: { name: 'article_id' },
    inverseJoinColumn: { name: 'tag_id' },
  })
  tags: Relation<Tag>[];

  @ManyToMany(() => User, (user) => user.favorites)
  @JoinTable({
    name: 'favorites',
    joinColumn: { name: 'article_id' },
    inverseJoinColumn: { name: 'user_id' },
  })
  favoritedBy: Relation<User>[];

  @OneToMany(() => Comment, (comment) => comment.article)
  comments: Relation<Comment>[];
}
