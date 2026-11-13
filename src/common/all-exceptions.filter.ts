import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { I18nService, t } from '@nestjs/i18n';
import type { Request, Response } from 'express';

type ErrorsBody = { errors: Record<string, string[]> };

/** Lỗi không do mình ném (Nest/Express tự sinh): field + key i18n theo mã trạng thái. */
const FRAMEWORK_ERRORS: Partial<Record<number, [string, string]>> = {
  [HttpStatus.BAD_REQUEST]: ['body', 'errors.malformed'], // JSON hỏng
  [HttpStatus.NOT_FOUND]: ['path', 'errors.notFound'], // route không tồn tại
  [HttpStatus.PAYLOAD_TOO_LARGE]: ['body', 'errors.tooLarge'], // > 100 kB
  [HttpStatus.TOO_MANY_REQUESTS]: ['request', 'errors.tooManyRequests'], // ThrottlerGuard
};

const isErrorsBody = (body: unknown): body is ErrorsBody =>
  typeof body === 'object' && body !== null && 'errors' in body;

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

    response
      .status(status)
      .json(
        isErrorsBody(raw) ? raw : this.toErrorsBody(status, exception, request),
      );
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
      return { errors: { [field]: [this.translate(key, request)] } };
    }
    const message =
      exception instanceof Error ? exception.message : String(exception);
    return { errors: { request: [message] } };
  }

  /**
   * Lỗi JSON hỏng xảy ra ở body-parser, **trước** middleware i18n → `t()` chưa có
   * ngữ cảnh ngôn ngữ (trả lại chính key). Khi đó tự chọn ngôn ngữ theo đúng thứ tự
   * resolver trong app.module.ts: `?lang` → `x-lang` → `Accept-Language`.
   */
  private translate(key: string, request: Request): string {
    const inContext = t(key as never);
    if (inContext !== key) return inContext;
    return this.i18n.translate(key, { locale: this.localeOf(request) });
  }

  private localeOf(request: Request): string | undefined {
    const query = request.query?.lang;
    const header = request.headers['x-lang'];
    const accepted = (request.headers['accept-language'] ?? '')
      .split(',')
      .map((part) => part.split(';')[0].trim());
    const candidates = [query, header, ...accepted].filter(
      (c): c is string => typeof c === 'string' && c.length > 0,
    );
    for (const candidate of candidates) {
      const locale = this.i18n.matchLocale(candidate);
      if (locale) return locale;
    }
    return undefined;
  }
}
