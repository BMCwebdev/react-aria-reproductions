import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
const path = process.env.EXPECT_CANCEL_REASON ? 'evidence/gap-results.json' : 'evidence/playwright-results.json';
try {
  let text = await readFile(path, 'utf8');
  // Public evidence should not contain the contributor's filesystem paths.
  text = text.replaceAll(process.cwd(), '<project-root>').replaceAll(homedir(), '<home>');
  // macOS resolves /private/tmp and /tmp to the same checkout.
  if (process.cwd().startsWith('/private/tmp/')) text = text.replaceAll(process.cwd().replace('/private/tmp/', '/tmp/'), '<project-root>');
  await writeFile(path, text);
} catch (error) { console.error(`Could not sanitize report: ${error.message}`); process.exit(1); }
process.exit(result.status ?? 1);
