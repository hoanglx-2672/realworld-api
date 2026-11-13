import { Controller, Get } from '@nestjs/common';
import { TagsService } from './tags.service.js';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  // GET /api/tags → { "tags": ["dragons", "nestjs"] }  (đúng định dạng spec RealWorld)
  @Get()
  async findAll() {
    return { tags: await this.tagsService.findAllNames() };
  }
}
