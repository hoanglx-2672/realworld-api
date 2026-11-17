import { Controller, Get } from '@nestjs/common';
import { TagsService } from './tags.service.js';
import type { TagsEnvelope } from './tags.types.js';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  // GET /api/tags → { "tags": ["dragons", "nestjs"] }  (đúng định dạng spec RealWorld)
  @Get()
  async findAll(): Promise<TagsEnvelope> {
    return { tags: await this.tagsService.findAllNames() };
  }
}
