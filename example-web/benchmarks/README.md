# Web mount benchmark

A deterministic 1,000-item list with 72px rows, 820px viewport and 1,000px draw distance. Runs fixed and measured sizing separately. Each context retains its first mount as sample -1, then reports medians of five fresh list mounts in the warmed renderer. This separates list mount cost from renderer startup variance; the first-mount samples remain available for analysis. Reports synchronous mount, readiness (onLoad plus two animation frames), settled main-thread task/script/layout CPU time (`threadTicks`), and mounted row/DOM counts. Production bundles share one React/React DOM installation. No network or app services are used.

Provide two source trees and existing dependencies; this script does not install dependencies or create worktrees. React and React DOM must have matching versions. `REACT_MODULES` is their node_modules directory; `PLAYWRIGHT_MODULE` can point to an existing Playwright module. Output goes outside the checkout.

```sh
export REACT_MODULES=/absolute/path/to/node_modules
export PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs
bun example-web/benchmarks/mount.ts build /baseline/tree /candidate/tree /output/directory
# Acquire the machine's performance measurement lock around this command:
bun example-web/benchmarks/mount.ts measure /baseline/tree /candidate/tree /output/directory
```

Each scenario records one warmup pair (`pair: -1`), then runs seven measured interleaved pairs using all six arm-order permutations and fresh browser contexts. A third arm repeats the baseline build to expose measurement noise. Exclude `pair: -1` from analysis. `PAIRS` changes the number of measured pairs. Keep browser, viewport, dependencies and machine conditions identical. Compare paired deltas and uncertainty, not just the fastest run. A confidence interval spanning zero is inconclusive, not proof of equivalence.
