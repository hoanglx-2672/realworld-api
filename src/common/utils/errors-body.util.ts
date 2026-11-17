import { HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import type { ErrorsBody } from '../types/errors-body.type.js';

export const isErrorsBody = (body: unknown): body is ErrorsBody =>
  typeof body === 'object' && body !== null && 'errors' in body;

/**
 * 400 của framework: SyntaxError (JSON hỏng) và URIError (path kiểu /api/x/%FF) đều thành
 * BadRequestException giống nhau → phân biệt bằng việc request có gửi body hay không.
 */
export function frameworkErrorField(
  status: number,
  field: string,
  request: Request,
): string {
  if (status !== Number(HttpStatus.BAD_REQUEST)) return field;
  const length = Number(request.headers['content-length'] ?? 0);
  return length > 0 || request.headers['transfer-encoding']
    ? 'body'
    : 'request';
}
