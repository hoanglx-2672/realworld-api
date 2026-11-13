import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  type Relation,
} from 'typeorm';
import { Article } from '../articles/article.entity.js';
import { BaseEntity } from '../common/base.entity.js';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  username: string;

  /** Hash bcrypt, không bao giờ lưu mật khẩu gốc. `select: false` để không lộ khi query. */
  @Column({ select: false })
  password: string;

  /** Spec: user mới có bio = null; gửi chuỗi rỗng thì lưu null. */
  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', nullable: true })
  image: string | null;

  @OneToMany(() => Article, (article) => article.author)
  articles: Relation<Article>[];

  /** Những người mà user này đang follow. Bảng nối `follows`. */
  @ManyToMany(() => User, (user) => user.followers)
  @JoinTable({
    name: 'follows',
    joinColumn: { name: 'follower_id' },
    inverseJoinColumn: { name: 'following_id' },
  })
  following: Relation<User>[];

  @ManyToMany(() => User, (user) => user.following)
  followers: Relation<User>[];

  /** Bài viết user đã favorite. Bảng nối `favorites` khai báo phía Article. */
  @ManyToMany(() => Article, (article) => article.favoritedBy)
  favorites: Relation<Article>[];
}
