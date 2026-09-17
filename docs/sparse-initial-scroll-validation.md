# Sparse initial-scroll simplification validation

Validated on 2026-09-17 in the `sparse-layout` worktree against starting commit
`7db8ccb4`. Existing uncommitted native QA fixtures and diagnostics were used for
validation and left outside these commits.

## Changes

| Commit | Change |
| --- | --- |
| `8d5de8f0` | Remove unused sparse scroll bookkeeping and unreachable size switches. |
| `abfad59d` | Consolidate initial target/session state and coalesce frame work. |
| `1a94febd` | Cancel late alignment on user input; add vertical/horizontal lifecycle fixtures. |
| `f178afea` | Query the sparse layout store for the bootstrap viewport. |
| `60759794` | Preserve pending native resize corrections through clamping/MVCP overshoot. |

The production diff removes 706 lines net (403 added, 1,109 removed under `src/`).
Tests and fixtures are additional to that count. The layout store's measured-average
estimation policy remains unchanged and enabled by default. Native completion fixes
already present in the sparse branch are retained.

The range-query regression uses 100,000 items, with a requested index of 90,000
and a view offset placing the viewport at item 10,000. The original scan performs
160,008 layout offset/size reads; the new implementation requires fewer than 20
and returns the same visible rows. This is a work-count result, not an end-to-end
startup timing benchmark. Additional tests cover fixed sizes below the estimate,
unequal column cells, header/padding adjustments, and footer-only viewports.

## Automated checks

- `bun test`: 2,041 passed, zero failed, across 150 files.
- `bun run tsc`: source, public type tests, native example, and web example passed.
- `bun run build`: passed, including its lint prebuild and postbuild steps.
- Biome autofix was applied to touched files; repository lint passed over 528 files.
- Test visualization and coverage generation passed: 92.21% line coverage. The
  generated HTML was written outside the worktree to preserve the user's existing
  modified visualization.

The native overshoot tests were run before the correction and failed on both iOS
and Android simulations. They pass after the correction. Component tests verify
that a drag still cancels queued and dispatched alignment immediately.

## Web fixtures

Run `bun run dev:fixtures` in `example-web`.

`/initial-scroll-lifecycle` and `/initial-scroll-lifecycle-horizontal` exercise
empty/populated startup, two footer changes, an append, and viewport shrinkage.
Independent DOM geometry checks confirmed:

- End targets reach the browser's end with zero gap and the final row visible.
- Index 20 remains at the leading edge, with offset 1,560, on both axes.
- Scrolling imperatively to row 10 during the sequence retains offset 840.
- Real wheel input during initialization retains the user's offset through later
  footer, append, and viewport updates, on both axes.
- Remounting during initialization produces one `onLoad` for the new mount.
- Footer growth after the preservation window expires leaves the scroll offset
  unchanged (the vertical end gap increases from zero to 40).

`/qa/sparse-layout.html` passed all 44 checks, covering arrays/data sources,
both axes, and React Strict Mode. No browser errors were recorded.

A pre-existing web limitation remains: horizontal trailing padding is omitted
from the browser scroll extent in this flex layout. Both the original and final
source produce a 4,160-pixel extent with this fixture's 32-pixel right padding.
The original lifecycle implementation also stopped 388 pixels before the end in
the delayed horizontal run; the final implementation reached the actual end.

## iOS fixtures

Used iPhone 17 Pro simulator, iOS 26.5, Fabric, React Native 0.81.5, development
build `com.legendapp.listtest`, with Metro resolving this worktree's source.

The final 32-step recorded replay passed: empty first load, last-index viewport
expansion, dragging away, appending while away, and verifying user position.
Checks use fixture identifiers and native visibility; the sparse matrix separately
uses `measureInWindow` geometry with four consecutive stable samples.

The first replay exposed a regression: viewport clamping plus MVCP could overshoot
an outstanding initial correction, which was mistaken for user movement. The
original source passed the isolated resize replay; the candidate failed it.
After `60759794`, the isolated replay and full targeted replay passed. Native drag
handlers remain the explicit cancellation boundary during pending alignment.

### Remaining native acceptance gap

The broad sparse matrix initially passed 44/44. The final run passed 42/44:
`append / source / vertical` failed in both passes because the appended tail did
not reach the viewport end. This fixture has no initial-scroll target.

A controlled run using the original `7db8ccb4` source passed 43/44 and failed
`append / source / horizontal` with the same missing-tail symptom. Baseline source
selection was verified by a temporary module marker. Thus end-following
instability exists in the baseline, but the different axes and timing mean this
comparison does not establish that all failures share one cause. Passing earlier
runs do not erase these failures. Resolving the rapid-append race and repeating
the native matrix remains necessary for unconditional native acceptance.

Android and legacy React Native architectures were covered by automated tests,
but not run live in this session. No Android emulator was available; the legacy
example dependencies were not installed. Scrollbar-drag stress was not exercised.
