import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  AcceptLanguageLocaleResolver,
  HeaderLocaleResolver,
  I18nService,
  type LocaleResolver,
  QueryLocaleResolver,
} from '@nestjs/i18n';
import type { Request, Response } from 'express';

type ErrorsBody = { errors: Record<string, string[]> };

/** Lỗi không do mình ném (Nest/Express tự sinh): field + key i18n theo mã trạng thái. */
const FRAMEWORK_ERRORS: Partial<Record<number, [string, string]>> = {
  // JSON hỏng → 'body'; path sai mã hoá (/api/x/%FF) → 'request' (xem fieldOf)
  [HttpStatus.BAD_REQUEST]: ['body', 'errors.malformed'],
  [HttpStatus.NOT_FOUND]: ['path', 'errors.notFound'], // route không tồn tại
  [HttpStatus.PAYLOAD_TOO_LARGE]: ['body', 'errors.tooLarge'], // > 100 kB
  [HttpStatus.TOO_MANY_REQUESTS]: ['request', 'errors.tooManyRequests'], // ThrottlerGuard
};

/**
 * 400 của framework: SyntaxError (JSON hỏng) và URIError (path kiểu /api/x/%FF) đều thành
 * BadRequestException giống nhau → phân biệt bằng việc request có gửi body hay không.
 */
function fieldOf(status: number, field: string, request: Request): string {
  if (status !== Number(HttpStatus.BAD_REQUEST)) return field;
  const length = Number(request.headers['content-length'] ?? 0);
  return length > 0 || request.headers['transfer-encoding']
    ? 'body'
    : 'request';
}

/** Cùng danh sách và thứ tự với I18nModule trong app.module.ts. */
const LOCALE_RESOLVERS: LocaleResolver[] = [
  new QueryLocaleResolver('lang'),
  new HeaderLocaleResolver('x-lang'),
  new AcceptLanguageLocaleResolver(),
];

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
      return {
        errors: {
          [fieldOf(status, field, request)]: [this.translate(key, request)],
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
   * quá lớn) xảy ra **trước** middleware i18n nên không có ngữ cảnh. Dùng đúng các resolver,
   * cùng thứ tự với app.module.ts, nên mọi lỗi chọn cùng một ngôn ngữ
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
