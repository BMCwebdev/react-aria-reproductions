import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Current-release comparison as checked on 2026-10-05. Baseline source and lock
// remain untouched; the resolved comparison manifest/lock and results are saved.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(join(tmpdir(), 'react-aria-use-move-current-'));
const excluded = new Set(['node_modules', 'dist', 'test-results', 'playwright-report', 'evidence', 'pnpm-lock.yaml']);
await cp(root, temp, { recursive: true, filter: path => !excluded.has(basename(path)) });
const manifest = JSON.parse(await readFile(join(temp, 'package.json'), 'utf8'));
manifest.dependencies = { react: '19.3.0', 'react-dom': '19.3.0', 'react-aria': '3.52.1' };
await writeFile(join(temp, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const pnpm = process.env.npm_execpath;
function run(args) {
  const result = pnpm
    ? spawnSync(process.execPath, [pnpm, ...args], { cwd: temp, stdio: 'inherit', env: process.env })
    : spawnSync('pnpm', args, { cwd: temp, stdio: 'inherit', env: process.env });
  if (result.status !== 0) throw new Error(`pnpm ${args.join(' ')} failed (${result.status})`);
}
console.log(`Comparison directory: ${temp}`);
run(['install']);
run(['build']);
let failure;
try { run(['test']); } catch (error) { failure = error; }
const out = join(root, 'evidence', 'current');
await mkdir(out, { recursive: true });
for (const file of ['package.json', 'pnpm-lock.yaml']) await cp(join(temp, file), join(out, file));
await cp(join(temp, 'evidence'), out, { recursive: true });
console.log(`Saved comparison dependency pins and results: ${out}`);
if (failure) throw failure;
