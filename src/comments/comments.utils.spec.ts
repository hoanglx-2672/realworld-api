import { COMMENT_ID_MAX } from './comments.constants.js';
import { parseCommentId } from './comments.utils.js';

describe('parseCommentId', () => {
  it.each([
    ['1', 1],
    ['42', 42],
    [String(COMMENT_ID_MAX), COMMENT_ID_MAX],
  ])('%s → %d', (raw, id) => {
    expect(parseCommentId(raw)).toBe(id);
  });

  it.each([
    '0',
    '-1',
    'abc',
    '1.5',
    '1e3',
    ' 1',
    '',
    String(COMMENT_ID_MAX + 1),
    '99999999999',
  ])('%j → undefined', (raw) => {
    expect(parseCommentId(raw)).toBeUndefined();
  });
});
