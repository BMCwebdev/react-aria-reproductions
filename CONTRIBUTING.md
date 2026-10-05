# Maintaining these reproductions

Keep each example independently runnable using public packages. Preserve exact
version pins and commit the lockfiles. Record comparisons with newer dependencies
separately from the original baseline.

Every reported result should identify the source revision, package versions,
browser and version, operating system, input mechanism, and command or manual
steps. A Playwright engine version is not evidence from an installed retail
browser. A dispatched PointerEvent is synthetic input, even when run in a real
browser. Label forced component states and deliberate rendering load explicitly.

Keep diagnostic native event listeners observational. If a comparison adds
consumer policy, label it and show which behavior comes from that policy.
Do not present an example that directly injects a bad state as proof that an
ordinary interaction can reach it.

Run each example's build and browser checks before publishing. The static build
and deployment workflow live in this repository so future contributors can
reproduce the work without a desktop AI session.
