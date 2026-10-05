import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { createRequire } from 'node:module';
const automationPackage = process.env.PLAYWRIGHT_PACKAGE || '@playwright/test';
const { chromium, firefox } = await import(automationPackage);
import { preview } from 'vite';

const require = createRequire(import.meta.url);
const engine = process.argv[2] || 'firefox';
const requested = process.argv[3] || 'all';
const attempts = Number(process.env.ATTEMPTS || 25);
const port = Number(process.env.PORT || 4174);
if (!['firefox', 'chromium'].includes(engine)) throw new Error('Engine must be firefox or chromium.');
if (!Number.isInteger(attempts) || attempts < 1) throw new Error('ATTEMPTS must be a positive integer.');
const allowedCases = ['all', 'smoke', 'synthetic', 'synthetic-guard', 'gesture-normal', 'gesture-load', 'gesture-animation', 'gesture-animation-load', 'gesture-load-guard', 'sweep-normal', 'sweep-animation', 'sweep-load', 'sweep-guard', 'dialog-load'];
if (!allowedCases.includes(requested)) throw new Error(`Unknown case: ${requested}`);
const output = resolve(process.env.EVIDENCE_DIR || `evidence/${engine}/${requested}`);
await mkdir(output, { recursive: true });
const versions = Object.fromEntries(['react', 'react-dom', 'react-aria', 'react-aria-components', 'vite', '@playwright/test'].map(name => [name, require(`${name}/package.json`).version]));
versions['react-stately'] = createRequire(require.resolve('react-aria/package.json'))('react-stately/package.json').version;
const server = await preview({ preview: { host: '127.0.0.1', port, strictPort: true } });
const browser = await { firefox, chromium }[engine].launch(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {});
const sourceDigest = createHash('sha256');
for (const file of ['src/main.tsx', 'src/style.css', 'scripts/probe.mjs', 'package.json', 'pnpm-lock.yaml']) sourceDigest.update(file).update(await readFile(file));
let revision = null;
try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
const report = { source: { gitRevision: revision, sha256: sourceDigest.digest('hex'), files: ['src/main.tsx', 'src/style.css', 'scripts/probe.mjs', 'package.json', 'pnpm-lock.yaml'] }, command: `ATTEMPTS=${attempts} PLAYWRIGHT_PACKAGE=${automationPackage} node scripts/probe.mjs ${engine} ${requested}`, automation: { package: automationPackage, version: require(`${automationPackage}/package.json`).version }, capturedAt: new Date().toISOString(), platform: `${os.type()} ${os.release()} ${os.arch()}`, browser: { engine, version: browser.version() }, versions, attempts, cases: [] };
const configs = [
  ['synthetic', '?mode=synthetic'], ['synthetic-guard', '?mode=synthetic&guard=1'],
  ['gesture-normal', '?'], ['gesture-load', '?load=1'],
  ['gesture-animation', '?animate=1'], ['gesture-animation-load', '?animate=1&load=1'],
  ['gesture-load-guard', '?load=1&guard=1'],
  ['sweep-normal', '?sequence=sweep'], ['sweep-animation', '?sequence=sweep&animate=1'], ['sweep-load', '?sequence=sweep&load=1'],
  ['sweep-guard', '?sequence=sweep&guard=1'], ['dialog-load', '?composition=dialog&load=1'],
];
const isBad = f => f.visible && (!f.placement || (f.x < 25 && f.y < 30));
let failures = 0;
try {
  for (const [name, query] of configs.filter(([name]) => requested === 'all' || name === requested || (requested === 'smoke' && ['synthetic', 'synthetic-guard', 'gesture-normal'].includes(name)))) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: resolve(output, 'video'), size: { width: 1440, height: 900 } } });
    const page = await context.newPage();
    const entry = { name, query, errors: [], trials: [] };
    report.cases.push(entry);
    page.on('pageerror', error => entry.errors.push(String(error)));
    try {
      await page.goto(`http://127.0.0.1:${port}/${query}`);
      await page.locator('[data-trigger="Warmup"]').waitFor();
      await page.evaluate(() => window.tooltipProbe.start());
      if (name.startsWith('synthetic')) {
        await page.waitForTimeout(150);
        entry.diagnostics = await page.evaluate(() => window.tooltipProbe.stop());
        const f = entry.diagnostics.frames.at(-1);
        if (!f || f.placement !== null || !f.exiting || f.width <= 0 || f.height <= 0) throw new Error('Synthetic fixture did not reach measurable unpositioned exit.');
        if (name.endsWith('guard') ? f.visible : !f.visible) throw new Error('Synthetic fixture visibility differs from requested guard setting.');
        entry.verdict = name.endsWith('guard') ? 'synthetic fixture measurable and hidden' : 'synthetic fixture visible without placement (not a real gesture reproduction)';
      } else {
        const warm = await page.locator('[data-trigger="Warmup"]').boundingBox();
        const target = await page.locator('[data-trigger="Target"]').boundingBox();
        const blank = await page.locator('#blank').boundingBox();
        const point = r => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
        const move = async r => { const p = point(r); await page.mouse.move(p.x, p.y); };
        const clickBlank = async () => { const p = point(blank); await page.mouse.click(p.x, p.y); };
        for (let i = 0; i < attempts; i++) {
          await clickBlank();
          await move(warm); await page.waitForTimeout(600);
          if (name.startsWith('sweep')) {
            for (let sweep = 0; sweep < 12; sweep++) { await move(sweep % 2 === 0 ? target : warm); await page.waitForTimeout(40); }
          } else {
            await move(blank); await page.waitForTimeout(450);
            await clickBlank();
            await move(target); await page.waitForTimeout(40);
          }
          await move(blank);
          const leftAt = await page.evaluate(() => performance.now());
          await page.waitForTimeout(3100);
          const snapshot = await page.evaluate(() => window.tooltipProbe.snapshot());
          const trialFrames = snapshot.frames.filter(f => f.time >= leftAt);
          const bad = trialFrames.filter(isBad);
          const persistent = bad.filter(f => f.time - leftAt >= 3000);
          entry.trials.push({ i, leftAt, badFrames: bad.length, persistentFramesAfter3s: persistent.length, firstBad: bad[0] || null });
          if (bad.length) await page.screenshot({ path: resolve(output, `${name}-trial-${i}-after-3s.png`) });
          await move(target); await page.waitForTimeout(950);
          const recovered = await page.locator('[role="tooltip"][data-for="Target"]').evaluateAll(tips => tips.map(t => ({ placement: t.getAttribute('data-placement'), ...{ x: t.getBoundingClientRect().x, y: t.getBoundingClientRect().y }, visibility: getComputedStyle(t).visibility, width: t.getBoundingClientRect().width, height: t.getBoundingClientRect().height, opacity: getComputedStyle(t).opacity })));
          entry.trials.at(-1).longHover = recovered;
          entry.trials.at(-1).longHoverPositioned = recovered.some(t => t.placement && t.visibility === 'visible' && Number(t.opacity) > 0 && Math.abs(t.x + t.width / 2 - target.x - target.width / 2) < 2 && Math.min(Math.abs(t.y - target.y - target.height), Math.abs(target.y - t.y - t.height)) <= 16);
          if (!entry.trials.at(-1).longHoverPositioned) throw new Error('Long hover did not produce a visible tooltip anchored to Target.');
          if (bad.length) await page.screenshot({ path: resolve(output, `${name}-trial-${i}-long-hover.png`) });
          await move(blank); await page.waitForTimeout(550);
        }
        entry.diagnostics = await page.evaluate(() => window.tooltipProbe.stop());
        entry.badFrames = entry.diagnostics.frames.filter(isBad).length;
        entry.persistentTrials = entry.trials.filter(t => t.persistentFramesAfter3s > 0).length;
        entry.verdict = entry.persistentTrials ? 'real gesture reproduced visible unpositioned tooltip after 3 seconds in empty space' : entry.badFrames ? 'unpositioned visible frames observed; 3-second persistence not observed' : 'no unpositioned visible tooltip observed in these trials';
        if (!entry.diagnostics.frames.some(f => f.visible && f.placement)) throw new Error('Probe did not observe a visible positioned tooltip.');
        if (process.env.EXPECT_REPRO === '1' && !name.endsWith('guard') && !entry.persistentTrials) throw new Error('Expected real gesture persistence was not observed.');
        if (name.endsWith('guard') && entry.badFrames) throw new Error('Placement guard left visible unpositioned frames.');
      }
      await page.screenshot({ path: resolve(output, `${name}-final.png`) });
      if (entry.errors.length) throw new Error('Page raised errors.');
      entry.status = 'completed';
    } catch (error) {
      entry.status = 'failed'; entry.error = String(error); failures++;
      await page.screenshot({ path: resolve(output, `${name}-failed.png`) });
    } finally {
      await context.close();
      const videoPath = await page.video()?.path();
      entry.video = videoPath ? relative(output, videoPath) : null;
      await writeFile(resolve(output, `${name}.json`), JSON.stringify(entry, null, 2) + '\n');
      console.log(JSON.stringify({ name, status: entry.status, verdict: entry.verdict, badFrames: entry.badFrames, persistentTrials: entry.persistentTrials, error: entry.error }));
    }
  }
} finally {
  await browser.close(); await server.close();
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
if (!report.cases.length) throw new Error('No cases were executed.');
if (failures) process.exitCode = 1;
