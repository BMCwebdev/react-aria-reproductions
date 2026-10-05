# React Aria tooltip positioning in Firefox

Runnable investigation for [react-spectrum#10496](https://github.com/adobe/react-spectrum/issues/10496), with a separate deterministic fixture for the reported unpositioned exit state. The real pointer race has **not been reproduced in this standalone app** in the recorded trials. Do not present the synthetic fixture as proof of that race or as proof that the upstream issue is fixed.

The application imports only public React and React Aria packages. No private registry, Stitch package, StyleX, Storybook, or application layout provider is required.

## Run

Use Node 22.13+ and pnpm 11.3.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:4174/` in Firefox. The frozen baseline is React/React DOM 19.2.3, React Aria Components 1.20.0, React Aria 3.51.0, and React Stately 3.49.0. Overrides in `pnpm-workspace.yaml` prevent the state and interaction implementations drifting independently. The lockfile captures all remaining transitive versions.

To inspect the production build:

```sh
pnpm build
pnpm preview
```

`BASE_PATH` overrides Vite's default relative asset paths when building for a hosted subdirectory.

## Real gesture

The default page uses uncontrolled `TooltipTrigger` state, `delay={400}`, the default close delay and placement, `offset={8}`, and `containerPadding={8}`.

1. Click **Start capture**. Hover **Warmup** for about 600ms.
2. Move to empty space for about 450ms; click empty space.
3. Briefly hover **Target** (about 40ms) and return to empty space.
4. Wait at least 3 seconds with the pointer resting there. Look for a tooltip stranded at the viewport's top-left.
5. Hover **Target** for at least 900ms. A normal tooltip should be visible and anchored to that button.
6. Stop capture to inspect buffered geometry and open-state changes.

`?sequence=sweep` instead provides the warmed-up row-sweep sequence described in [this upstream report](https://github.com/adobe/react-spectrum/issues/10496#issuecomment-5600274611). After the initial warmup, sweep between the two triggers repeatedly before leaving the row. The automated version makes 12 moves with 40ms dwell per button.

Optional conditions are explicit URL flags:

| Flag | Meaning |
| --- | --- |
| `load=1` | During capture, block the main thread for 35ms every 45ms; a stress condition, not ordinary browsing. |
| `animate=1` | Add a 160ms exit animation; the default has no animation. |
| `guard=1` | Hide the tooltip with `visibility: hidden` while its render-prop `placement` is null. It remains measurable. |
| `composition=dialog` | Put Target's TooltipTrigger inside a controlled public RAC DialogTrigger, with a Popover/Dialog sibling. |
| `mode=synthetic` | Force closed trigger state and `isExiting`. This is a separate synthetic fixture, not a pointer reproduction. |

The optional DialogTrigger composition investigates a relevant difference from the original application: its notification trigger also opens a popover. Decorative icons, badge content, dynamic StyleX button classes, responsive header layout, provider state, and the Storybook iframe are omitted. These remaining differences have not been isolated as a cause. The original Tooltip wrapper itself had no exit animation; `animate=1` is an additional experiment.

## Automated evidence

```sh
pnpm exec playwright install firefox
pnpm test
```

`pnpm test` builds the production app and runs the synthetic unpositioned-exit fixture, its guarded counterpart, and one real normal-gesture trial. It asserts measurable synthetic geometry, expected synthetic visibility, and actual visible long-hover positioning. Passing smoke checks do **not** mean the reported intermittent race was reproduced or fixed.

The extended probe records screenshots, browser video, exact package/browser/OS versions, source SHA-256, command, open-state changes, and animation-frame geometry:

```sh
ATTEMPTS=25 pnpm probe firefox gesture-load
ATTEMPTS=25 pnpm probe firefox sweep-normal
ATTEMPTS=25 pnpm probe firefox dialog-load
ATTEMPTS=3 pnpm probe firefox all
```

Valid individual cases: `synthetic`, `synthetic-guard`, `gesture-normal`, `gesture-load`, `gesture-animation`, `gesture-animation-load`, `gesture-load-guard`, `sweep-normal`, `sweep-animation`, `sweep-load`, `sweep-guard`, `dialog-load`. `smoke` and `all` select groups. Invalid names and nonpositive attempt counts fail.

The symptom detector flags visible frames without calculated placement or at the viewport origin, and separately counts observations still present at least 3 seconds after leaving the trigger. Recovery is only recorded as positioned when a visible tooltip has placement and is adjacent to Target. Set `EXPECT_REPRO=1` to make a real-gesture case fail unless it observes the 3-second symptom. Guard cases fail if any unpositioned visible frames occur.

Diagnostics are buffered and displayed after capture, so no React state updates are introduced by frame sampling. Geometry sampling itself can still affect a timing-sensitive issue. `load=1` is always identified separately in reports. Recorded browser runs are headless; a negative result does not establish that manual or headed browsing cannot reproduce it.

Output defaults to `evidence/<engine>/<case>/`. `EVIDENCE_DIR` chooses another folder, and `PORT` overrides the probe's default local port 4174. Report media paths are relative to that evidence folder.

### Historical browser

A separate pinned Playwright 1.59.1 alias permits testing the original Firefox 148.0.2 build without changing the primary Playwright 1.63.0 runner:

```sh
node node_modules/playwright-historical/cli.js install firefox
PLAYWRIGHT_PACKAGE=playwright-historical ATTEMPTS=25 pnpm probe firefox gesture-load
```

### Current library comparison

```sh
ATTEMPTS=2 node scripts/compare-current.mjs firefox all
```

This script copies the source into an isolated temporary directory and pins React/React DOM 19.3.0, React Aria Components 1.21.1, React Aria 3.52.1, and React Stately 3.50.0. It installs, builds, and runs exactly the same probe on port 4175, preserving the baseline manifest and lockfile. Its own `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` are retained alongside evidence. All three files are needed for a frozen reinstall. These are the current package versions checked on 2026-10-05, not floating `latest` versions.

See [RESULTS.md](RESULTS.md) for observed results and their limits. [Related PR #10502](https://github.com/adobe/react-spectrum/pull/10502) and the newer `useAnimation` proposal are upstream candidates; this fixture does not incorporate either patch.
