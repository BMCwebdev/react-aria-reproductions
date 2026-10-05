# React Aria reproductions

Two independent, minimal browser examples for existing React Spectrum discussions.
Each uses public dependencies and plain CSS. Neither requires Stitch, a private
package registry, credentials, or proprietary assets.

**[Open the examples](https://bmcwebdev.github.io/react-aria-reproductions/)**

| Example | Upstream discussion |
| --- | --- |
| [Tooltip positioning](tooltip-firefox/) | [adobe/react-spectrum#10496](https://github.com/adobe/react-spectrum/issues/10496), related [PR #10502](https://github.com/adobe/react-spectrum/pull/10502) |
| [useMove cancellation](use-move/) | [adobe/react-spectrum#10652](https://github.com/adobe/react-spectrum/issues/10652) |

Read the [useMove results](use-move/evidence/RESULTS.md) and
[tooltip investigation results](tooltip-firefox/RESULTS.md) before interpreting
the examples. The tooltip's ordinary hover race has not reproduced in the
recorded reduced example; its synthetic exit fixture demonstrates a separate,
explicitly forced state.

Each directory is a standalone Vite project with its own manifest and lockfile.
Read its README for manual reproduction steps, automated checks, and the limits
of the evidence. Reports distinguish normal browser input, synthetic input, and
deliberately forced component states.

## Run locally

Use Node 22.22.3 or newer supported by Vite, and pnpm 11.3.0.

```sh
cd use-move # or tooltip-firefox
pnpm install --frozen-lockfile
pnpm dev
```

## Static hosting

`node scripts/build-site.mjs` builds both examples into `site/`. The generated
site contains only static HTML, JavaScript, CSS, and selected evidence files.
No application server is required.

The GitHub Pages workflow builds and tests the examples before deployment. Enable
**Settings → Pages → Build and deployment → GitHub Actions** in an approved
public repository. Repository creation and Pages publication must be permitted
by the repository owner's organization settings.

For another static host, run:

```sh
SITE_BASE=/ node scripts/build-site.mjs
```

For a project Pages URL, use `SITE_BASE=/repository-name/`. The workflow computes
this from the repository name. Each example has a full-page URL so browser
behavior can be examined without an editor or iframe around it.

## Version comparisons

The reproduction baseline preserves React 19.2.3, React Aria 3.51.0, and (for
Tooltip) React Aria Components 1.20.0. Public npm versions checked on 2026-10-05
were React 19.3.0, React Aria 3.52.1, and RAC 1.21.1. Comparison runs are recorded
separately; they do not silently update the baseline.
