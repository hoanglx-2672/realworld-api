import { testDatabaseName } from './test-database.js';

// e2e xoá sạch DB này: không được để cấu hình nào trỏ nhầm vào DB dev.
describe('testDatabaseName', () => {
  it.each([undefined, '', '  '])('bỏ trống (%p) → realworld_test', (value) => {
    expect(
      testDatabaseName({ DB_DATABASE: 'realworld', DB_DATABASE_TEST: value }),
    ).toBe('realworld_test');
  });

  it('tên hợp lệ → giữ nguyên', () => {
    expect(
      testDatabaseName({
        DB_DATABASE: 'app',
        DB_DATABASE_TEST: 'app_e2e_test',
      }),
    ).toBe('app_e2e_test');
  });

  it.each([
    ['trùng DB_DATABASE', 'realworld_test', 'realworld_test'],
    ['không kết thúc bằng _test', 'realworld', 'realworld_dev'],
    ['có ký tự lạ', 'realworld', 'x"; DROP DATABASE realworld; --_test'],
  ])('%s → báo lỗi', (_, dev, test) => {
    expect(() =>
      testDatabaseName({ DB_DATABASE: dev, DB_DATABASE_TEST: test }),
    ).toThrow('DB_DATABASE_TEST');
  });
});
