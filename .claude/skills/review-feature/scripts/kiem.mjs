#!/usr/bin/env node
// Cổng kiểm trước khi mở PR cho realworld-api.
// Chạy từ gốc repo:  node .claude/skills/review-feature/scripts/kiem.mjs [--base=main] [--nhanh]
//   --base=<nhánh>  nhánh để so diff (mặc định: main, không có thì master; PR xếp chồng: nhánh của PR trước)
//   --nhanh         bỏ e2e và kiểm migration (khi đang sửa dở, không phải lần chốt)
// Thoát mã 1 nếu có mục FAIL. WARN không chặn nhưng phải nêu trong PR.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const NGUONG_DONG = 400; // guideline: "vài trăm dòng trở xuống"
const ketQua = [];

function chay(cmd, { im = true } = {}) {
  const r = spawnSync(cmd, { shell: true, encoding: 'utf8', stdio: im ? 'pipe' : 'inherit' });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}
function ghi(muc, trangThai, chiTiet = '') {
  ketQua.push({ muc, trangThai, chiTiet });
  console.log(`${trangThai.padEnd(4)}  ${muc}${chiTiet ? ` — ${chiTiet}` : ''}`);
}
function duoi(out, n = 15) {
  return out.trim().split('\n').slice(-n).join('\n');
}

if (!existsSync('package.json') || !existsSync('src')) {
  console.error('Hãy chạy từ thư mục gốc realworld-api.');
  process.exit(2);
}

// ---------- 1. Vệ sinh repo ----------
const laGit = chay('git rev-parse --is-inside-work-tree').ok;
let base = null;
if (laGit) {
  if (args.base !== undefined) {
    // PR xếp chồng: base là nhánh của PR trước, phải truyền đúng — sai thì dừng hẳn.
    if (typeof args.base !== 'string' || !chay(`git rev-parse --verify --quiet ${args.base}`).ok) {
      console.error(`--base không hợp lệ: ${args.base}`);
      process.exit(2);
    }
    base = args.base;
  } else {
    base = ['main', 'master'].find((b) => chay(`git rev-parse --verify --quiet ${b}`).ok) ?? null;
  }

  const envTracked = chay('git ls-files --error-unmatch .env').ok;
  ghi('.env không bị commit', envTracked ? 'FAIL' : 'PASS', envTracked ? 'chạy: git rm --cached .env' : '');
} else {
  ghi('Git', 'SKIP', 'chưa phải git repo — bỏ qua kiểm diff, cỡ PR, migration đã merge');
}

const coSync = timTrongSrc(/synchronize:\s*true/);
ghi('Không có synchronize: true', coSync ? 'FAIL' : 'PASS', coSync ? coSync.split('\n')[0] : '');

function timTrongSrc(re, thuMuc = 'src') {
  for (const ten of readdirSync(thuMuc, { withFileTypes: true })) {
    const p = join(thuMuc, ten.name);
    if (ten.isDirectory()) {
      const r = timTrongSrc(re, p);
      if (r) return r;
    } else if (p.endsWith('.ts') && re.test(readFileSync(p, 'utf8'))) {
      return p;
    }
  }
  return '';
}

// ---------- 2. Cỡ PR + migration đã merge bị sửa ----------
if (laGit && base) {
  // So working tree với điểm rẽ nhánh: gồm commit, thay đổi chưa commit và file mới chưa add.
  const goc = chay(`git merge-base ${base} HEAD`).out.trim();
  const numstat = chay(`git diff --numstat ${goc}`).out;
  let tong = 0;
  for (const f of chay('git ls-files --others --exclude-standard').out.split('\n').filter(Boolean)) {
    if (!/package-lock\.json$|\.snap$/.test(f)) tong += readFileSync(f, 'utf8').split('\n').length;
  }
  for (const dong of numstat.trim().split('\n').filter(Boolean)) {
    const [them, xoa, file] = dong.split('\t');
    if (/package-lock\.json$|\.snap$/.test(file)) continue;
    tong += (Number(them) || 0) + (Number(xoa) || 0);
  }
  ghi(`Cỡ PR so với ${base}`, tong > NGUONG_DONG ? 'WARN' : 'PASS',
    `${tong} dòng (bỏ package-lock)${tong > NGUONG_DONG ? ` > ${NGUONG_DONG}: cân nhắc tách PR` : ''}`);

  const suaMig = chay(`git diff --name-status ${goc} -- src/database/migrations`).out
    .split('\n').filter((l) => /^[MDR]/.test(l));
  ghi('Không sửa/xoá migration đã có trên base', suaMig.length ? 'FAIL' : 'PASS',
    suaMig.length ? `${suaMig.join(', ')} — tạo migration MỚI thay vì sửa` : '');
} else if (laGit) {
  ghi(`Cỡ PR`, 'SKIP', 'không thấy nhánh main/master — truyền --base=<nhánh>');
}

// ---------- 3. Lint, typecheck, test ----------
for (const [muc, cmd] of [
  ['Lint (oxlint)', 'npm run lint'],
  ['Typecheck', 'npx tsc --noEmit -p tsconfig.json'],
  ['Unit test', 'npm test'],
  ...(args.nhanh ? [] : [['E2E test', 'npm run test:e2e']]),
]) {
  const r = chay(cmd);
  ghi(muc, r.ok ? 'PASS' : 'FAIL', r.ok ? '' : `\n${duoi(r.out)}`);
}

// ---------- 4. Migration khớp entity ----------
if (args.nhanh) {
  ghi('Migration khớp entity', 'SKIP', '--nhanh');
} else if (!existsSync('src/database/data-source.ts') || !existsSync('src/database/migrations')) {
  ghi('Migration khớp entity', 'SKIP', 'chưa có src/database/data-source.ts hoặc thư mục migrations');
} else if (!chay('docker compose exec -T db pg_isready').ok) {
  ghi('Migration khớp entity', 'FAIL', 'Postgres chưa chạy: npm run db:up rồi chạy lại');
} else {
  const show = chay('npm run migration:show');
  if (!show.ok) {
    ghi('Migration khớp entity', 'FAIL', `\n${duoi(show.out)}`);
  } else if (/\[ \]/.test(show.out)) {
    ghi('Migration khớp entity', 'FAIL', 'còn migration chưa chạy: npm run migration:run rồi kiểm lại');
  } else {
    const dir = 'src/database/migrations';
    const truoc = new Set(readdirSync(dir));
    const gen = chay(`npm run migration:generate -- ${dir}/KiemTraTruocPr`);
    const moi = readdirSync(dir).filter((f) => !truoc.has(f));
    moi.forEach((f) => rmSync(join(dir, f))); // file thử, xoá ngay
    if (/No changes in database schema/.test(gen.out)) {
      ghi('Migration khớp entity', 'PASS', '"No changes in database schema"');
    } else {
      ghi('Migration khớp entity', 'FAIL', moi.length
        ? 'entity đã đổi mà chưa có migration: npm run migration:generate -- src/database/migrations/<Ten>'
        : `\n${duoi(gen.out)}`);
    }
  }
}

// ---------- 5. Sunlint ----------
if (!chay('sunlint --version').ok) {
  ghi('Sunlint', 'FAIL', 'chưa cài — guideline bắt buộc. Cài: npm install -g @sun-asterisk/sunlint');
} else {
  mkdirSync('.reports', { recursive: true });
  rmSync('.reports/sunlint.json', { force: true }); // không đọc nhầm kết quả lần trước
  const pham = laGit ? '--changed-files ' : '';
  const r = chay(`sunlint --all ${pham}--input=src --output-summary=.reports/sunlint.json`);
  let tom = '';
  if (existsSync('.reports/sunlint.json')) {
    const j = JSON.parse(readFileSync('.reports/sunlint.json', 'utf8'));
    const loi = Number(j.error_count ?? 0);
    tom = `error=${loi} warning=${j.warning_count ?? '?'} điểm=${j.quality?.score ?? '?'} → .reports/sunlint.json`;
    ghi('Sunlint', loi > 0 || !r.ok ? 'FAIL' : 'PASS', tom);
  } else {
    ghi('Sunlint', r.ok ? 'WARN' : 'FAIL', `không có file tóm tắt\n${duoi(r.out)}`);
  }
}

// ---------- Tổng kết ----------
const dem = (t) => ketQua.filter((k) => k.trangThai === t).length;
console.log(`\nTổng: ${dem('PASS')} PASS · ${dem('FAIL')} FAIL · ${dem('WARN')} WARN · ${dem('SKIP')} SKIP`);
process.exit(dem('FAIL') ? 1 : 0);
