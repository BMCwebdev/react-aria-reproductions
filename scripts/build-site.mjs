import {execFileSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'site');
const base = process.env.SITE_BASE || '/';
if (!base.startsWith('/') || !base.endsWith('/') || base.includes('..')) {
  throw new Error('SITE_BASE must be an absolute URL path ending in /.');
}
rmSync(output, {recursive: true, force: true});
mkdirSync(output, {recursive: true});
for (const name of ['tooltip-firefox', 'use-move']) {
  const args = ['--dir', resolve(root, name), 'build'];
  const pnpmScript = process.env.npm_execpath;
  execFileSync(pnpmScript ? process.execPath : 'pnpm', pnpmScript ? [pnpmScript, ...args] : args, {
    stdio: 'inherit',
    env: {...process.env, BASE_PATH: `${base}${name}/`},
  });
  cpSync(resolve(root, name, 'dist'), resolve(output, name), {recursive: true});
  if (existsSync(resolve(root, name, 'evidence'))) {
    cpSync(resolve(root, name, 'evidence'), resolve(output, name, 'evidence'), {recursive: true});
  }
}
writeFileSync(resolve(output, 'index.html'), `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>React Aria reproductions</title>
<style>body{font:18px/1.6 system-ui;max-width:48rem;margin:4rem auto;padding:0 1.5rem;color:#172033}a{color:#154bba}li{margin:1.5rem 0}</style>
<main><h1>React Aria reproductions</h1>
<p>Small, independent examples with visible diagnostics, pinned dependencies, and reproducible browser checks.</p>
<ul><li><a href="./tooltip-firefox/">Tooltip positioning</a><br>Brief-hover and exit-state behavior.</li>
<li><a href="./use-move/">useMove cancellation</a><br>Release, cancellation, pointer identity, and Escape rollback.</li></ul>
<p>Read the instructions in each example. Synthetic events and forced states are labelled separately from normal browser input.</p>
<p><a href="https://github.com/BMCwebdev/react-aria-reproductions">Source, pinned dependencies, commands and recorded results</a></p></main></html>`);
writeFileSync(resolve(output, '.nojekyll'), '');
console.log(`Built both reproductions in ${output} with URL base ${base}`);
