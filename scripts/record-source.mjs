import {createHash} from 'node:crypto';
import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const ignored = new Set(['node_modules', 'dist', 'site', 'evidence', '.git', 'test-results', 'playwright-report']);
const files = {};
function visit(directory) {
  for (const entry of readdirSync(directory, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
    if (ignored.has(entry.name) || entry.name === '.DS_Store') continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (entry.isFile()) files[relative(root, path)] = createHash('sha256').update(readFileSync(path)).digest('hex');
  }
}
visit(root);
const sourceHash = createHash('sha256').update(JSON.stringify(files)).digest('hex');
writeFileSync(resolve(root, 'evidence/source-manifest.json'), JSON.stringify({
  algorithm: 'sha256', sourceHash, files,
  note: 'Identifies source, tooling, instructions and dependency locks. Generated outputs and evidence are excluded to avoid a circular hash.',
}, null, 2) + '\n');
console.log(`Source fingerprint: ${sourceHash} (${Object.keys(files).length} files)`);
