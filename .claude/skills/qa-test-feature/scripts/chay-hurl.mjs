#!/usr/bin/env node
// Chạy bộ API test chính thức của RealWorld (Hurl) cho một feature.
// Chạy từ gốc repo, app phải đang chạy:
//   node .claude/skills/qa-test-feature/scripts/chay-hurl.mjs <feature|all> [--host=http://localhost:3000] [--npx]
//   feature: auth | profiles | articles | comments | authorization | favorites | tags | all
//   --npx       dùng `npx @orangeopensource/hurl` khi máy chưa cài hurl (chỉ dùng khi user đã đồng ý)
//   --tiep-tuc  chạy tiếp sau request hỏng (khi file còn request của feature chưa làm)
// Ghi kết quả ra docs/features/<feature>/qa-hurl.txt. Thoát mã 1 nếu có test hỏng.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BO_TEST = {
  auth: ['auth', 'errors_auth'],
  profiles: ['profiles', 'errors_profiles'],
  articles: ['articles', 'feed', 'pagination', 'errors_articles'],
  comments: ['comments', 'errors_comments'],
  authorization: ['errors_authorization'],
  favorites: ['favorites'],
  tags: ['tags'],
};
const THU_MUC = 'docs/realworld-spec/hurl';

const viTri = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const co = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.slice(2).split('=');
    return [k, v ?? true];
  }),
);
const feature = viTri[0];
if (!feature || (feature !== 'all' && !BO_TEST[feature])) {
  console.error(`Cách dùng: chay-hurl.mjs <${[...Object.keys(BO_TEST), 'all'].join('|')}> [--host=...] [--npx]`);
  process.exit(2);
}
if (!existsSync(THU_MUC)) {
  console.error(`Không thấy ${THU_MUC}. Hãy chạy từ gốc realworld-api.`);
  process.exit(2);
}

const host = (co.host ?? `http://localhost:${process.env.PORT ?? 3000}`).replace(/\/(api)?\/?$/, '');
const tenFile = feature === 'all' ? Object.values(BO_TEST).flat() : BO_TEST[feature];
const files = tenFile.map((f) => join(THU_MUC, `${f}.hurl`));

// App có đang chạy không? (fetch có sẵn trong Node 18+)
try {
  const r = await fetch(`${host}/api/tags`);
  if (r.status >= 500) throw new Error(`HTTP ${r.status}`);
} catch (e) {
  console.error(`App không trả lời ở ${host}/api/tags (${e.message}).\nBật DB + app trước: npm run db:up && npm run migration:run && npm run start:dev`);
  process.exit(2);
}

let lenh = 'hurl';
if (spawnSync('hurl --version', { shell: true }).status !== 0) {
  if (!co.npx) {
    console.error(
      'Máy chưa cài Hurl. Chọn một cách:\n'
      + '  - cài hẳn:   winget install Orange-OpenSource.Hurl\n'
      + '  - không cài: chạy lại script với --npx (tải @orangeopensource/hurl qua npx)',
    );
    process.exit(2);
  }
  lenh = 'npx -y @orangeopensource/hurl';
}

// uid khác nhau mỗi lần chạy để username/email không đụng lần trước.
const uid = `${Date.now()}${process.pid}`;
const tiepTuc = co['tiep-tuc'] ? ' --continue-on-error' : '';
const cmd = `${lenh} --test --jobs 1${tiepTuc} --variable host=${host} --variable uid=${uid} ${files.join(' ')}`;
console.log(`> ${cmd}\n`);
const r = spawnSync(cmd, { shell: true, encoding: 'utf8' });
const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
process.stdout.write(out);

const dirBaoCao = join('docs', 'features', feature);
mkdirSync(dirBaoCao, { recursive: true });
const baoCao = join(dirBaoCao, 'qa-hurl.txt');
writeFileSync(baoCao, `# ${new Date().toISOString()}  host=${host}  uid=${uid}\n# ${cmd}\n\n${out}`);
console.log(`\nĐã ghi ${baoCao}`);
process.exit(r.status === 0 ? 0 : 1);
