import { expect, test, type Locator, type Page } from '@playwright/test';
import os from 'node:os';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

async function open(page: Page, mode = 'raw') {
  await page.goto(`/?mode=${mode}`);
  const handle = page.getByRole('button', { name: 'Drag handle', exact: true });
  await handle.focus();
  return handle;
}
async function pointer(handle: Locator, type: string, x: number, id = 1, button = type === 'pointerdown' ? 0 : -1) {
  await handle.evaluate((element, details) => element.dispatchEvent(new PointerEvent(details.type, {
    bubbles: true, cancelable: true, pointerType: 'mouse', pointerId: details.id,
    button: details.button, buttons: details.type === 'pointerup' || details.type === 'pointercancel' ? 0 : 1,
    clientX: details.x, clientY: 500,
  })), { type, x, id, button });
}
async function callbacks(page: Page) {
  const text = await page.getByTestId('callback-log').innerText();
  return text === 'No callbacks yet.' ? [] : text.split('\n').map(line => JSON.parse(line));
}
async function state(page: Page, preview: number, committed: number) {
  await expect(page.getByTestId('preview')).toHaveText(String(preview));
  await expect(page.getByTestId('committed')).toHaveText(String(committed));
}

test.beforeEach(async ({ browser }, info) => {
  const packages = Object.fromEntries(['react', 'react-dom', 'react-aria', 'vite', '@playwright/test'].map(name => [name, JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8')).version]));
  await info.attach('environment', { body: JSON.stringify({ browser: info.project.name, version: browser.version(), os: os.type(), release: os.release(), architecture: os.arch(), node: process.version, packages, command: process.env.EXPECT_CANCEL_REASON ? 'pnpm test:gap' : 'pnpm test', sourceRevision: process.env.REPRO_SOURCE_REVISION || 'See repository source SHA256 manifest; captured before commit.', mainSourceSha256: createHash('sha256').update(readFileSync('src/main.tsx')).digest('hex') }), contentType: 'application/json' });
});
test.afterEach(async ({ page }, info) => {
  if (await page.getByTestId('callback-log').count()) await info.attach('event-logs', { body: JSON.stringify({ native: await page.getByTestId('native-log').innerText(), callbacks: await callbacks(page) }, null, 2), contentType: 'application/json' });
});

test('trusted mouse release commits and native log identifies trusted input', async ({ page }) => {
  const handle = await open(page);
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 70, box.y + 10);
  await state(page, 60, 0);
  await page.mouse.up();
  await state(page, 60, 60);
  await expect(page.getByTestId('native-log')).toContainText('"isTrusted":true');
});

test('visible scenario buttons expose raw cancellation and consumer rollback', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Normal release', exact: true }).click();
  await state(page, 60, 60);
  await page.getByRole('button', { name: 'Driving pointercancel', exact: true }).click();
  await state(page, 60, 60);
  await expect(page.getByTestId('native-log')).toContainText('"type":"pointercancel"');
  await open(page, 'rollback');
  await page.getByRole('button', { name: 'Driving pointercancel', exact: true }).click();
  await state(page, 0, 0);
  await page.getByRole('button', { name: 'Second pointercancel, then release driver', exact: true }).click();
  await state(page, 60, 60);
});

test('public end callbacks do not distinguish synthetic driving pointercancel from pointerup', async ({ page }) => {
  let handle = await open(page);
  await pointer(handle, 'pointerdown', 100);
  await pointer(handle, 'pointermove', 160);
  await pointer(handle, 'pointerup', 160);
  await state(page, 60, 60);
  const released = (await callbacks(page)).find(entry => entry.callback === 'onMoveEnd');
  handle = await open(page);
  await pointer(handle, 'pointerdown', 100);
  await pointer(handle, 'pointermove', 160);
  await pointer(handle, 'pointercancel', 160);
  await state(page, 60, 60);
  const cancelled = (await callbacks(page)).find(entry => entry.callback === 'onMoveEnd');
  await expect(page.getByTestId('native-log')).toContainText('"type":"pointercancel"');
  await expect(page.getByTestId('native-log')).toContainText('"isTrusted":false');
  expect(cancelled.pointerType).toBe('mouse');
  expect(cancelled.type).toBe('moveend');
  if (process.env.EXPECT_CANCEL_REASON) expect(cancelled).not.toEqual(released);
  else expect(cancelled).toEqual(released);
});

test('snapshot proposal resets on trusted Escape when no further movement occurs', async ({ page }) => {
  const handle = await open(page, 'snapshot');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 70, box.y + 10);
  await page.keyboard.press('Escape');
  await state(page, 0, 0);
  await page.mouse.up();
  await state(page, 0, 0);
});

test('snapshot proposal permits resumed trusted movement and release after Escape', async ({ page }) => {
  const handle = await open(page, 'snapshot');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 70, box.y + 10);
  await page.keyboard.press('Escape');
  await state(page, 0, 0);
  await page.mouse.move(box.x + 100, box.y + 10);
  await state(page, 30, 0);
  await page.mouse.up();
  await state(page, 30, 30);
});

test('consumer rollback suppresses trusted movement and commit after Escape', async ({ page }) => {
  const handle = await open(page, 'rollback');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 70, box.y + 10);
  await page.keyboard.press('Escape');
  await state(page, 0, 0);
  await page.mouse.move(box.x + 100, box.y + 10);
  await state(page, 0, 0);
  await page.mouse.up();
  await state(page, 0, 0);
});

test('consumer rollback rejects driving synthetic pointercancel without committing', async ({ page }) => {
  const handle = await open(page, 'rollback');
  await pointer(handle, 'pointerdown', 100);
  await pointer(handle, 'pointermove', 160);
  await state(page, 60, 0);
  await pointer(handle, 'pointercancel', 160);
  await state(page, 0, 0);
  expect((await callbacks(page)).filter(entry => entry.action === 'discard')).toHaveLength(1);
});

for (const mode of ['raw', 'rollback']) {
  test(`${mode}: first synthetic pointer stays driver when second presses before movement`, async ({ page }) => {
    const handle = await open(page, mode);
    await pointer(handle, 'pointerdown', 100, 1);
    await pointer(handle, 'pointerdown', 110, 2);
    await pointer(handle, 'pointermove', 200, 2);
    await state(page, 0, 0);
    await pointer(handle, 'pointermove', 160, 1);
    await state(page, 60, 0);
    await pointer(handle, 'pointercancel', 200, 2);
    await state(page, 60, 0);
    expect((await callbacks(page)).filter(entry => entry.callback === 'onMoveEnd')).toHaveLength(0);
    await pointer(handle, 'pointerup', 160, 1);
    await state(page, 60, 60);
  });
}

test('public pointerType identifies keyboard callbacks inside synthetic pointer drag', async ({ page }) => {
  const handle = await open(page);
  await pointer(handle, 'pointerdown', 100);
  await pointer(handle, 'pointermove', 160);
  await page.keyboard.press('ArrowRight');
  const entries = await callbacks(page);
  expect(entries.filter(entry => entry.pointerType === 'keyboard').map(entry => entry.callback)).toEqual(['onMoveStart', 'onMove', 'onMoveEnd']);
  expect(entries.filter(entry => entry.callback === 'onMoveStart').map(entry => entry.pointerType)).toEqual(['mouse', 'keyboard']);
  await pointer(handle, 'pointerup', 160);
});

test('consumer rollback ignores keyboard update/end and preserves pointer ownership', async ({ page }) => {
  const handle = await open(page, 'rollback');
  await pointer(handle, 'pointerdown', 100);
  await pointer(handle, 'pointermove', 160);
  await page.keyboard.press('ArrowRight');
  await state(page, 60, 0);
  await pointer(handle, 'pointermove', 190);
  await state(page, 90, 0);
  await pointer(handle, 'pointercancel', 190);
  await state(page, 0, 0);
});

test('Chromium protocol touchCancel produces a trusted native pointercancel', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Chromium CDP-only input generation; Firefox has synthetic-event coverage.');
  const handle = await open(page);
  const box = (await handle.boundingBox())!;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 10, y: box.y + 10, id: 7 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 70, y: box.y + 10, id: 7 }] });
  await state(page, 60, 0);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await state(page, 60, 60);
  const native = (await page.getByTestId('native-log').innerText()).split('\n').map(line => JSON.parse(line));
  expect(native).toContainEqual(expect.objectContaining({ type: 'pointercancel', pointerType: 'touch', isTrusted: true }));
  expect((await callbacks(page)).find(entry => entry.callback === 'onMoveEnd')).toMatchObject({ type: 'moveend', pointerType: 'touch' });
});
