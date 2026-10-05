# Verified results — 2026-10-05

The baseline and pinned current-release comparison each passed **23 tests**, with **one intentional Firefox skip** for the Chromium-only browser-protocol touch-cancellation check. Both production builds and TypeScript checks passed. The separate API-gap assertion failed as intended because release and cancellation returned equal public end payloads.

## Environment and source

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.7, build 25G229; Darwin 25.6.0; arm64 |
| Chromium | 151.0.7922.34, cached Playwright Chromium build 1234 selected explicitly |
| Firefox | 155.0, Playwright Firefox build 1543 |
| Test runner Node | 20.19.1 |
| Dependency installation driver | Node 22.22.3, pnpm 11.3.0 |
| Playwright | 1.63.0 |
| Baseline | React/DOM 19.2.3, react-aria 3.51.0 |
| Current comparison | React/DOM 19.3.0, react-aria 3.52.1 |
| Main source SHA256 | `329e607d64a4d501be2a5eb9b6157641ecd97baacbfff4f750926c752f4a80d8` |

The baseline lockfile and `current/pnpm-lock.yaml` record transitive dependency versions. Each test embeds package and browser versions plus the source digest. The root repository's source manifest records the full source set before publication.

The local environment selected cached Chromium with `CHROMIUM_EXECUTABLE_PATH`; its version above is authoritative, rather than Playwright 1.63's default Chromium revision. Firefox used the installed default build. Downloading the default Chromium build failed certificate-chain validation; TLS validation was not disabled. A standard environment can run `pnpm exec playwright install chromium firefox` and record its own browser versions.

## Commands and recorded outcomes

The published commands are `pnpm build`, `pnpm test`, `pnpm test:gap`, and `pnpm test:current`. The local Corepack shim failed to load pnpm, so equivalent scripts were invoked directly:

```sh
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
CHROMIUM_EXECUTABLE_PATH="$CACHED_CHROMIUM" node scripts/run-tests.mjs
EXPECT_CANCEL_REASON=1 CHROMIUM_EXECUTABLE_PATH="$CACHED_CHROMIUM" \
  node scripts/run-tests.mjs -g 'public end callbacks' --project chromium
CHROMIUM_EXECUTABLE_PATH="$CACHED_CHROMIUM" npm_execpath="$PNPM_CJS" \
  "$NODE_22" scripts/compare-current.mjs
```

`CACHED_CHROMIUM`, `PNPM_CJS`, and `NODE_22` above stand for local executable paths; the actual paths are omitted from public evidence. The current comparison script runs the same source in an isolated copy and invokes `pnpm build` and `pnpm test` there. Baseline files remain unchanged.

Normal baseline suite: `23 passed (15.9s)`, `1 skipped`. Current comparison: `23 passed (20.3s)`, `1 skipped`. Gap command: `1 failed`, on `expect(cancelled).not.toEqual(released)`; the objects were equal.

## Findings

| Case | Observed outcome in both dependency sets |
| --- | --- |
| Trusted mouse movement and release | Preview 60; committed 60 |
| Maintainer snapshot/reset interpretation, Escape then immediate release | Preview and committed return to 0 |
| Same interpretation, Escape then another 30px movement and release | Preview and committed become 30 |
| Added consumer discard flag, same continued movement after Escape | Preview and committed stay 0 |
| Raw callbacks, synthetic driver pointercancel | Preview and committed become 60; public `onMoveEnd` is identical to release |
| Added owning-pointer cancellation policy | Driver cancellation restores 0 and does not commit |
| Second pointer presses before the first moves | First pointer remains the driver; second pointer movement/cancel does not end it |
| Keyboard input during held pointer drag | Public callbacks identify it as `pointerType: "keyboard"`; consumer can ignore it without a new discriminator |
| Chromium protocol-generated trusted touchCancel | Browser emits trusted native `pointercancel`; raw `useMove` delivers `moveend` and the example commits |

For mouse release and synthetic mouse cancellation, the public payload is:

```json
{"type":"moveend","pointerType":"mouse","shiftKey":false,"metaKey":false,"ctrlKey":false,"altKey":false}
```

The keyboard/pointer discriminator request should therefore be narrowed: `pointerType` already solves that distinction. The unresolved information is normal release versus native cancellation. The Escape snapshot/reset suggestion is useful; suppressing the remainder of a discarded gesture is additional consumer policy.

## Limits

Most cancellation and multi-pointer scenarios use untrusted `PointerEvent`s dispatched on the handle and allowed to bubble in real browsers. Chromium also covers browser-protocol-generated trusted touch cancellation. Neither constitutes a physical touch-device or OS interruption test. No manual screen-reader coverage is claimed. This is an evaluation of public callback behavior and a small policy example, not a production splitter implementation.

Full sanitized reports: `playwright-results.json`, `gap-results.json`, and `current/playwright-results.json`. Event-log and environment attachments are embedded in those JSON reports. Failure screenshots referenced by Playwright are local diagnostic artifacts and are not necessary to reproduce or evaluate the failing assertion.
