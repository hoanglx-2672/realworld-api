import type { Request } from 'express';
import { frameworkErrorField, isErrorsBody } from './errors-body.util.js';

const requestWith = (headers: Record<string, string>) =>
  ({ headers }) as unknown as Request;

describe('isErrorsBody', () => {
  it('nhận object có key errors', () => {
    expect(isErrorsBody({ errors: { email: ['is invalid'] } })).toBe(true);
  });

  it.each([null, undefined, 'errors', 422, { message: 'x' }])(
    'từ chối %p',
    (body) => {
      expect(isErrorsBody(body)).toBe(false);
    },
  );
});

describe('frameworkErrorField', () => {
  it('không phải 400 → giữ field gốc', () => {
    expect(frameworkErrorField(404, 'path', requestWith({}))).toBe('path');
  });

  it('400 có body (JSON hỏng) → body', () => {
    const request = requestWith({ 'content-length': '5' });
    expect(frameworkErrorField(400, 'body', request)).toBe('body');
  });

  it('400 gửi body dạng chunked → body', () => {
    const request = requestWith({ 'transfer-encoding': 'chunked' });
    expect(frameworkErrorField(400, 'body', request)).toBe('body');
  });

  it('400 không có body (path sai mã hoá) → request', () => {
    expect(frameworkErrorField(400, 'body', requestWith({}))).toBe('request');
  });
});
