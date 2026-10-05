# useMove cancellation reproduction

Standalone public reproduction for [adobe/react-spectrum#10652](https://github.com/adobe/react-spectrum/issues/10652). No private packages, registry credentials, application assets, or design-system wrapper are required.

## Run

Use Node 22.12+ and pnpm 11.3.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:4173`. A static build is `pnpm build`; serve `dist/` with `pnpm preview`. `BASE_PATH=/some/path/ pnpm build` supports a hosted subdirectory; the default relative base also supports static previews.

## Three modes

- **Raw useMove with commit on end:** `onMove` updates preview and `onMoveEnd` commits it. Native input is logged separately without affecting the callbacks.
- **Snapshot + Escape reset:** a faithful minimal interpretation of [the maintainer's suggestion](https://github.com/adobe/react-spectrum/issues/10652#issuecomment-5920842054), which supplied a pattern rather than code. `onMoveStart` saves position and a focused target's Escape `onKeyDown` restores it. No extra cancellation flag is added.
- **Consumer rollback policy:** adds a cancellation flag that ignores movement and end/commit after Escape until release, ignores keyboard changes while a pointer drag owns the interaction, and watches cancellation for the owning native pointer before the public end callback commits.

Tab to the handle, drag, press Escape while holding, continue movement, then release. Compare preview and committed values. The labelled buttons run normal-release, driver-cancel, and unrelated-pointer-cancel sequences without needing a physical cancellation gesture. Changing modes reloads a clean example.

## What this evaluates

The maintainer's snapshot/reset suggestion successfully restores the initial position. Continuing to move the held pointer resumes changes, so a consumer that requires cancellation to discard the entire remaining gesture needs a small additional flag. That policy is not presented as a defect in `useMove`.

`pointerType` already distinguishes keyboard from pointer callbacks. The example corrects any implication that an extra keyboard/pointer discriminator is required. `useMove` also preserves the first pointer when another pointer presses before movement, and ignores the unrelated pointer's cancellation in the cases tested.

The remaining request is narrower: the public `onMoveEnd` payload for a driving pointer's native cancellation is indistinguishable from its normal release. Both report `type: "moveend"` and the same pointer type/modifier keys, with no reason or native event identity. A consumer that wants to roll back browser cancellation but commit normal release must observe native events separately. No particular upstream API design is prescribed here.

## Checks

```sh
pnpm exec playwright install chromium firefox
pnpm build
pnpm test
pnpm test:gap
pnpm test:current
```

`pnpm test` verifies the observed behavior plus the consumer policy. `pnpm test:gap` deliberately fails while cancellation and release yield identical public end payloads; it is a red-capable API-gap demonstration, separate from the normal passing suite. It is not a CI gate for this reproduction.

`pnpm test:current` copies the source to a temporary directory, installs the exact comparison versions below, builds and runs the same checks. It preserves the baseline manifest/lockfile and saves the comparison's resolved manifest, lockfile and sanitized test report under `evidence/current/`.

| Layer | Baseline | Current-release comparison checked 2026-10-05 |
| --- | --- | --- |
| React / React DOM | 19.2.3 | 19.3.0 |
| react-aria | 3.51.0 | 3.52.1 |
| Vite | 8.3.2 | 8.3.2 |
| Playwright | 1.63.0 | 1.63.0 |

The comparison is deliberately pinned rather than automatically tracking a changing `latest` tag. Resolved dependencies are in the respective lockfiles.

If using already installed browsers, optional `CHROMIUM_EXECUTABLE_PATH` and `FIREFOX_EXECUTABLE_PATH` override Playwright's bundled executable selection. Browser versions are recorded in every executed test's environment attachment; the recorded version is authoritative when an override is used.

## Evidence boundaries

Mouse and keyboard tests use browser automation input with trusted DOM events. Most cancellation and multiple-pointer cases explicitly dispatch untrusted `PointerEvent`s on the handle and let them bubble, exercising native propagation order and React Aria's real pointer path. They are not jsdom tests.

One Chromium-only test uses the browser protocol's `Input.dispatchTouchEvent` with `touchCancel`, producing a trusted native `pointercancel` and the same public end callback. This is browser-protocol input, not a physical touch-device or OS-gesture test. Firefox skips only that protocol-specific case and retains the synthetic cancellation matrix. No manual screen-reader or physical-device coverage is claimed.

Reports in `evidence/` include versions, commands, source digest and event logs. Personal filesystem paths are sanitized automatically. See `evidence/RESULTS.md` for the verified outcomes and environment.
