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

### Rapid-append race: reproduced and fixed

The earlier final run failed 2/44 sparse native cases; the original `7db8ccb4`
source also failed an append case. The follow-up investigation isolated two ways
that queued `maintainScrollAtEnd` work could be cancelled without user input:

1. An instant end scroll completes against predicted geometry. Its late native
   acknowledgement and a small measurement/MVCP correction arrive while the next
   follow is queued. Offset-based cancellation mistakes the backward correction
   for user input.
2. `checkAtBottom` preserves the end anchor during active following but omitted
   `pending-instant` and `pending-animated`. A late scroll event clears the flag;
   a subsequent measurement calls `doMaintainScrollAtEnd`, which discards the
   queued follow before its animation frame runs.

The second ordering was captured in a failed horizontal data-source case:
completion → queued replay → native offsets 92300.667 then 92292.667 → threshold
false → row measurement → `finishMaintainScrollAtEnd`. A regression reproduces
that sequence synchronously and failed on both iOS and Android before the fix.

Native following now uses the existing drag handler for user cancellation instead
of inferring intent from offsets. Web offset-based cancellation remains intact.
Queued follow states preserve the same end-anchor flag as active states. This adds
no state, timers, retry loops, measurements, allocations, or native calls. The
production change is three small edits, net five lines including comments/imports;
no runtime performance improvement is claimed without a benchmark.

The six native event-order regressions also failed against an isolated clean copy
of `main` (`6a36516d`) and passed with these same changes. The shared cancellation
logic is therefore affected on main. The equivalent live array workload on main
passed 40/40; a live main failure was not reproduced. Main has no data-source API.
The main checkout was left unchanged.

Final follow-up validation on iPhone 17 Pro Max, iOS 26.5, Fabric / RN 0.81.5:

- Append-only workload: **120/120** across three runs, arrays/data sources and both
  axes, with 1,200 mixed-size rows and four batches of three appends 60 ms apart.
  A 414 × 378 viewport retained the dimensions used to reproduce the failure.
- Restored full native matrix: **44/44 twice**, including replacement, initial
  jumps, prepend, append, reset, revision gaps, and prepend during scrolling.
- Geometry assertions require the actual last-row edge to meet the native viewport
  end within two pixels for four consecutive samples; list state alone is not the
  acceptance oracle.
- Native user-cancellation fixture: drag away, append, and verify that the user
  remains away from the end. Component tests cover pending/active, instant/animated
  cancellation; first-measurement cancellation tests cover web/iOS/Android.
- Browser sparse matrix: **44/44** with the final fix. The chat end-follow fixture
  also reached a zero-pixel end gap after typing-footer removal, a response append,
  and composer resizing. Wheel input then moved to offset 2,002; another append
  preserved that offset and left a 472-pixel end gap.
- Full working-tree suite: **2,051 passed**, zero failed; source/public-types/native
  example/web example typechecks, repository lint and production build passed.
  The exact staged tree was exported without the pre-existing user fixtures or
  diagnostics and passed **2,038/2,038** tests. Coverage visualization regenerated
  outside the worktree: **92.22%** lines.

The partial fix (native cancellation guards alone) passed one 40-case native run
but failed on repetition. Only the combined fix passed the repeated runs above.
Temporary instrumentation and fixture restrictions were removed. Existing user
QA fixtures and diagnostic changes remain outside the fix commit.

Android and legacy React Native architectures were covered by automated tests,
but not run live in this session. No Android emulator was available; the legacy
example dependencies were not installed. Scrollbar-drag stress was not exercised.
