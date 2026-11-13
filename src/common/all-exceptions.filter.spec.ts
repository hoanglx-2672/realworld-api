import {
  type ArgumentsHost,
  BadRequestException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { I18nService } from '@nestjs/i18n';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

/** Ngoài request thật thì không có ngữ cảnh i18n → filter dịch qua I18nService. */
const i18n = {
  translate: vi.fn(
    (key: string, opts?: { locale?: string }) =>
      `${opts?.locale ?? 'en'}:${key}`,
  ),
  matchLocale: vi.fn((c: string) => (c.startsWith('vi') ? 'vi' : undefined)),
} as unknown as I18nService;

function run(exception: unknown, request: object = {}) {
  const json = vi.fn();
  const response = { status: vi.fn((_code: number) => ({ json })) };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        path: '/api/x',
        query: {},
        headers: {},
        ...request,
      }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter(i18n).catch(exception, host);
  return {
    status: response.status.mock.calls[0][0],
    body: json.mock.calls[0][0],
  };
}

describe('AllExceptionsFilter', () => {
  beforeEach(() =>
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
  );
  afterEach(() => vi.restoreAllMocks());

  it('lỗi đã đúng dạng {"errors"} → giữ nguyên', () => {
    const body = { errors: { email: ['is invalid'] } };
    expect(run(new UnprocessableEntityException(body))).toEqual({
      status: 422,
      body,
    });
  });

  it('lỗi không lường trước → 500 câu chung, có ghi log, không lộ message gốc', () => {
    const { status, body } = run(
      new Error('duplicate key ... password=$2a$10...'),
    );
    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body).toEqual({ errors: { server: ['en:errors.internal'] } });
    expect(JSON.stringify(body)).not.toContain('password');
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
  });

  it('404 của framework → field path; chọn ngôn ngữ theo Accept-Language', () => {
    const { body } = run(new NotFoundException('Cannot GET /api/x'), {
      headers: { 'accept-language': 'fr-FR,vi;q=0.8' },
    });
    expect(body).toEqual({ errors: { path: ['vi:errors.notFound'] } });
  });

  it.each([
    ['en;q=0.1, vi;q=0.9', 'vi'],
    ['vi;q=0, en', 'en'],
    ['*, vi;q=0.5', 'vi'],
  ])(
    'Accept-Language %s → %s (xét trọng số q như resolver của app)',
    (header, locale) => {
      const { body } = run(new NotFoundException(), {
        headers: { 'accept-language': header },
      });
      expect(body.errors.path[0]).toBe(`${locale}:errors.notFound`);
    },
  );

  it('?lang thắng x-lang và Accept-Language', () => {
    const { body } = run(new NotFoundException(), {
      query: { lang: 'vi' },
      headers: { 'x-lang': 'en', 'accept-language': 'en' },
    });
    expect(body.errors.path[0]).toBe('vi:errors.notFound');
  });

  it.each([
    [{ 'content-length': '9' }, 'body'],
    [{}, 'request'],
  ])('400 của framework, header %j → field %s', (headers, field) => {
    const { body } = run(new BadRequestException('x'), { headers });
    expect(body).toEqual({ errors: { [field]: ['en:errors.malformed'] } });
  });

  it('lỗi 4xx thường (không có trong bảng) → không ghi log', () => {
    run(new NotFoundException());
    expect(Logger.prototype.error).not.toHaveBeenCalled();
  });
});
