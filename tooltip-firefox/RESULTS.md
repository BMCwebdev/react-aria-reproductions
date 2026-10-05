# Recorded tooltip findings

The standalone real pointer failure has **not reproduced in the completed trials below**. The synthetic exit fixture does reproduce the unpositioned visible state and verifies the placement-visibility guard. Those are different results.

All retained browser runs are headless on macOS 26.7, Darwin 25.6.0, arm64, with a 1440 × 900 viewport. Captured on 2026-10-05. Reports retain the browser's exact version, package versions, automation package, invocation, and source digest. Video paths are relative to the report folder.

## Baseline dependencies

React/React DOM 19.2.3; React Aria Components 1.20.0; React Aria 3.51.0; React Stately 3.49.0. Full dependency resolution is in the baseline lockfile.

| Run | Browser / automation | Observed result |
| --- | --- | --- |
| [Final smoke](evidence/final-smoke/report.json) | Firefox 155.0 / Playwright 1.63.0 | Synthetic closed/exiting tooltip is visible at `(0, 0)` with no placement; guard makes it hidden while retaining geometry. One normal gesture trial observed no unpositioned visible frame; its long hover was visible and correctly anchored. |
| [Raw short-hover under load](evidence/firefox148-final/report.json) | Firefox 148.0.2 / Playwright 1.59.1 | Twenty-five real short-hover trials on the final source with bounded main-thread load: zero unpositioned visible frames and zero 3-second persistence observations. Long-hover positioning passed in every trial. |
| [Dialog composition](evidence/firefox148-dialog/report.json) | Firefox 148.0.2 / Playwright 1.59.1 | Ten real short-hover trials with controlled DialogTrigger/Popover composition and bounded main-thread load: zero unpositioned visible frames and zero 3-second persistence observations. Long-hover positioning passed in every trial. |

The synthetic Target tooltip measured approximately 112.47 × 28 pixels at `(0, 0)` with `placement: null` and `exiting: true`. Unguarded visibility was `visible`; guarded visibility was `hidden`. See [unguarded screenshot](evidence/final-smoke/synthetic-final.png) and [guarded screenshot](evidence/final-smoke/synthetic-guard-final.png). This state is explicitly forced through public props.

## Current dependency comparison

[Current matrix report](evidence/current-final/report.json): React/React DOM 19.3.0, React Aria Components 1.21.1, React Aria 3.52.1, React Stately 3.50.0; Firefox 155.0 with Playwright 1.63.0.

Two trials each across eight unguarded configurations (normal/load, animation/animation+load, warmed sweep/sweep+animation/sweep+load, dialog+load) produced zero unpositioned visible frames and zero 3-second persistence observations: 16 unguarded trials total. Two guarded gesture configurations had two trials each with no invalid painted frame. Every real trial passed the visible anchored long-hover assertion. Synthetic unguarded/guarded checks both behaved as expected.

The baseline package files were unchanged. The comparison retains its own [manifest](evidence/current-final/package.json), [lockfile](evidence/current-final/pnpm-lock.yaml), and [override configuration](evidence/current-final/pnpm-workspace.yaml). Its source digest is `2970a8bc11e2cfcc9205b9575035748439a1bf1813929d78a782362f466c3777`, recomputed successfully from the delivered shared source plus those comparison package files.

## Interpretation

The guard addresses the synthetic painted-at-origin state. It leaves the node measurable and does not alter React Aria state or positioning. This is evidence for the guard's rendering behavior, not proof that it fixes the underlying lifecycle or that the real race has been minimized to raw RAC.

The public dialog composition tests one difference from the original application. The standalone app still omits its decorative icon/badge content, dynamic StyleX button classes, responsive header layout, application providers, and Storybook iframe. These have been inspected as differences, not established as causes. The default reproduction uses no CSS animation because the original Tooltip wrapper had none; animation modes are additional experiments.

The newer upstream report proposes resolving an exiting animation immediately when its ref is null. This package neither incorporates nor validates that proposed upstream change. With no real failing gesture in this app, a before/after patch result here would not establish that it fixes the reported race.

Negative sampled trials do not prove absence in manual/headed browsing or under other timing. Frame measurement may perturb scheduling; stress cases deliberately add 35ms of main-thread work every 45ms. The synthetic fixture should be described as synthetic whenever linked upstream.

## Evidence provenance

The baseline source SHA-256 in final reports covers, in order, each filename followed by its bytes: `src/main.tsx`, `src/style.css`, `scripts/probe.mjs`, `package.json`, `pnpm-lock.yaml`. It is `4e0931d1c0d9f9b5827758c7c64e06d2a333c1076672224560b783bb9a2de327` for the delivered baseline fixture. A null Git revision means these runs preceded the source's first commit; the digest is the identity.

Earlier exploratory runs used explicit bottom placement and an earlier diagnostic runner. They are superseded by the final-source runs and are not the evidence linked from this report.
