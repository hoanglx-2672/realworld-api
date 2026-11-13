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
    const rows = await this.tags
      .createQueryBuilder('tag')
      .select('tag.name', 'name')
      .where('EXISTS (SELECT 1 FROM article_tags at WHERE at.tag_id = tag.id)')
      .orderBy('tag.name', 'ASC')
      .getRawMany<{ name: string }>();
    return rows.map((row) => row.name);
  }
}
