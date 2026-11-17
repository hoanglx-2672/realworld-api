import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const CACHE_CONTROL_HEADER = 'Cache-Control';
export const NO_STORE = 'no-store';

/**
 * Response của API chứa dữ liệu riêng (token, email, bài nháp...): cấm trình duyệt
 * và proxy lưu cache (Sunlint S037). Đặt ở middleware để áp cho mọi route. Lỗi của
 * body-parser xảy ra trước middleware: AllExceptionsFilter tự đặt header này (ISS-24).
 */
@Injectable()
export class NoStoreMiddleware implements NestMiddleware {
  use(_request: Request, response: Response, next: NextFunction): void {
    response.setHeader(CACHE_CONTROL_HEADER, NO_STORE);
    next();
  }
}
