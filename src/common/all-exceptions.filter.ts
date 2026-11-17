import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { I18nService } from '@nestjs/i18n';
import type { Request, Response } from 'express';
import { FRAMEWORK_ERRORS } from './constants/error.constants.js';
import { CACHE_CONTROL_HEADER, NO_STORE } from './constants/http.constants.js';
import { LOCALE_RESOLVERS } from './constants/i18n.constants.js';
import type { ErrorsBody } from './types/errors-body.type.js';
import { frameworkErrorField, isErrorsBody } from './utils/errors-body.util.js';

/**
 * Mọi lỗi ra ngoài đều có dạng spec `{"errors": {"<field>": ["<câu>"]}}`:
 * - lỗi mình ném bằng `errorsException` / validation → giữ nguyên
 * - lỗi của framework (JSON hỏng, sai route, body quá lớn) → đổi sang định dạng spec
 * - lỗi không lường trước → 500 câu chung, **ghi log kèm stack** (không lộ chi tiết DB ra ngoài)
 */
@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw =
      exception instanceof HttpException ? exception.getResponse() : null;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Chỉ path (không query string), không header: không lộ token vào log.
      // JSON.stringify escape ký tự điều khiển → path lạ không chèn được dòng log giả.
      this.logger.error(
        `${request.method} ${JSON.stringify(request.path)} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // Lỗi xảy ra khi response đã gửi một phần: không ghi thêm được nữa (setHeader sẽ ném
    // ERR_HTTP_HEADERS_SENT và che mất lỗi gốc) → chỉ log ở trên rồi dừng.
    if (response.headersSent) return;

    // Lỗi body-parser (JSON hỏng, body quá lớn) chạy trước NoStoreMiddleware → đặt lại ở đây.
    response.setHeader(CACHE_CONTROL_HEADER, NO_STORE);
    // Body `errors` tự dựng chỉ giữ nguyên với lỗi 4xx; 5xx luôn trả câu chung để không lộ
    // chi tiết bên trong (vd. detail của DB) ra ngoài.
    const body =
      status < HttpStatus.INTERNAL_SERVER_ERROR && isErrorsBody(raw)
        ? raw
        : this.toErrorsBody(status, exception, request);
    response.status(status).json(body);
  }

  private toErrorsBody(
    status: number,
    exception: unknown,
    request: Request,
  ): ErrorsBody {
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return {
        errors: { server: [this.translate('errors.internal', request)] },
      };
    }
    const known = FRAMEWORK_ERRORS[status];
    if (known) {
      const [field, key] = known;
      return {
        errors: {
          [frameworkErrorField(status, field, request)]: [
            this.translate(key, request),
          ],
        },
      };
    }
    // 4xx khác của framework (403 mặc định, 415 charset của body-parser...): câu tiếng Anh gốc
    // không qua i18n → thay bằng câu chung đã dịch.
    return {
      errors: { request: [this.translate('errors.requestInvalid', request)] },
    };
  }

  /**
   * Luôn tự chọn ngôn ngữ, không dựa vào ngữ cảnh i18n: lỗi body-parser (JSON hỏng, body
   * quá lớn) xảy ra **trước** middleware i18n nên không có ngữ cảnh. Dùng chung
   * LOCALE_RESOLVERS với I18nModule, nên mọi lỗi chọn cùng một ngôn ngữ
   * (`Accept-Language` xét cả trọng số q, bỏ `*` và `q=0`).
   */
  private translate(key: string, request: Request): string {
    return this.i18n.translate(key, { locale: this.localeOf(request) });
  }

  private localeOf(request: Request): string | undefined {
    const input = { headers: request.headers, query: request.query ?? {} };
    for (const resolver of LOCALE_RESOLVERS) {
      const found = resolver.resolve(input);
      const candidates = Array.isArray(found) ? found : [found];
      for (const candidate of candidates) {
        if (typeof candidate !== 'string' || !candidate) continue;
        const locale = this.i18n.matchLocale(candidate);
        if (locale) return locale;
      }
    }
    return undefined;
  }
}
