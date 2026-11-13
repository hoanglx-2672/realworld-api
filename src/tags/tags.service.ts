import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tag } from './tag.entity.js';

@Injectable()
export class TagsService {
  constructor(@InjectRepository(Tag) private readonly tags: Repository<Tag>) {}

  /**
   * Tag còn được ít nhất một bài dùng, sắp alphabet. Tag không còn bài nào (bài bị
   * xoá, hoặc bị gỡ tag) vẫn nằm trong bảng `tags` để dùng lại, nhưng không hiện ra.
   */
  async findAllNames(): Promise<string[]> {
    // JOIN theo quan hệ Tag.articles: tên bảng nối / cột lấy từ metadata của entity,
    // không viết tay trong SQL (đổi @JoinTable thì truy vấn vẫn đúng).
    const rows = await this.tags
      .createQueryBuilder('tag')
      .select('tag.name', 'name')
      .innerJoin('tag.articles', 'article')
      .groupBy('tag.id')
      .getRawMany<{ name: string }>();
    // Sắp ở JS, cùng cách với tagList của article (so theo mã ký tự): ORDER BY của
    // Postgres theo collation của DB (en_US bỏ qua "-": "cats" trước "c-sharp").
    return rows.map((row) => row.name).sort();
  }
}
