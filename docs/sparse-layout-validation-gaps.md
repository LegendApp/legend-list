# Sparse layout validation and remaining acceptance

Reviewed the full `sparse-layout` branch against merge base
`e9f90bcfb4e8cce9111971f31d72d443d5989f0b` on September 16, 2026.
The current source is `1819a769`, with expanded tests in `5249d461`.
Both confirmed browser defects are fixed. The follow-up review found no additional
confirmed correctness defects. Native acceptance remains incomplete for this candidate.

## Resolved findings

### Reset recovery schedules mounted measurements (`4914de42`)

Previously, resizing a source row from the 50-pixel estimate to 90 pixels and then
resetting unchanged content returned the next row to its estimated position.
Reset and revision-gap recovery failed across both axes and Strict Mode settings.
Clearing size caches was insufficient because unchanged DOM bounds need not emit
another ResizeObserver notification.

Geometry invalidation now requests measurement through the shared mounted-layout
trigger. New architecture and web coalesce an all-container pass; legacy rows
request native measurement after the triggered commit, even when onLayout does
not fire. Assignment/generation checks continue to reject obsolete callbacks.
The legacy rerender trigger previously did not perform this measurement.

Twelve mounted recovery cases now consume and assert the scope scheduled by the
reset itself, then apply native measurements. They cover reset, revision gap and
changed-key fallback, both axes, one/two columns, zero-sized rows and repeated
recovery. Legacy hook coverage verifies that invoking the registered trigger
actually measures and restores unchanged dimensions, twice.

### Strict Mode restores delayed visibility (`1819a769`)

Previously, effect replay disposed scheduled work while retaining the old
visibility deadline. An idle Strict Mode mount, or one followed by an unrelated
rerender, could lose its callback indefinitely.

Cleanup now clears visibility timing before disposal; setup recalculates so idle
lists rearm without another event. Mounted array/source regressions fail when the
fix is removed, pass with it, and verify no later callback after unmount. Existing
rerender cases still preserve uninterrupted eligibility deadlines.

The original array Strict Mode failure passed against clean `main` (`e9f90bcf`),
confirming a branch regression. The same baseline reproduced the already-fixed
footer-only visibility defect. The unrelated dirty main checkout was not modified.

## New automated coverage

- Six dense-reference mutation scenarios exercise 1,200 batches containing 4,800
  mixed operations across one and three columns. Assertions cover sparse key
  caches, retained/invalidated measurements, surviving scroll-target identities,
  offsets, totals and bounded source-key reads.
- Mounted grid tests combine queued source updates, moves and replacements with
  changing column counts, then verify every mounted payload and packed position
  against an independent model in both axes.
- Array/source/array/source transitions verify listener ownership, fresh source
  state on return, and absence of obsolete mounted rows.
- Observer tests cover repeated start, stop/restart after missed edits, and
  synchronous notification during subscription without duplicate reset.
- Timing tests cover independent configuration deadlines, removal of one callback
  pair while another remains pending, and switching minimum time off and on.

## Browser verification

The self-running page `example-web/qa/sparse-layout.html` uses actual React DOM,
ResizeObserver, scroll events, recycling and timers. It is separate from app
routes and production bundles, and included in the web TypeScript check.

```sh
cd example-web
bun run dev:fixtures --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173/qa/sparse-layout.html`. Read the JSON in `#results`;
`data-status` becomes `passed` or `failed` when all scenarios finish. The page
runs 44 scenarios across arrays/sources, both axes and Strict Mode on/off.
Idle and rerendered visibility, growth/shrink measurement and scrolling run
independently. Sources additionally exercise reset, revision gaps and replacement.
`?arraysOnly` selects the 16 array controls.

**44/44 passed on two consecutive unchanged runs of the final source**, in
Chrome 152 through Argent CDP with React 18.3.1 and Vite. Existing web dependencies
were linked into the worktree; no dependencies or lockfiles changed. The web
example typecheck and production build pass. The browser page is not invoked by
`test:release`; run it separately before publishing. A CI browser runner remains
a tooling follow-up, not a claim that the unit gate covers browser execution.

## Release checks and follow-up review

- `bun run lint:fix` and `git diff --check`: pass.
- `bun run test:release`: pass. The default suite reports 1,961 tests, 147 files
  and 1,820,206 assertions; child-process regressions include 44 focused mounted
  cases and legacy/web measurement cases.
- Normalized changed-line coverage: **3,344/3,356 (99.64%)**, from 163 runs.
  This is line coverage, not exhaustive state-transition or branch coverage.
- Source/public/package type checks, library build and web fixture build: pass.
- Mutation scaling benchmark: source-key reads equal affected materialized
  updates at 1k/10k/100k cache sizes. The 2,000-operation/10k-cache sample took
  0.302 ms in Bun. Timing is diagnostic, not a frame-rate acceptance result.

The review traced sparse sequence/row geometry, mutation identity and revision
recovery, measurement invalidation, estimate changes, scroll targets/anchors,
viewability timing/subscriptions, and public wrapper types against their callers
and tests. The fixes remain at cache and effect lifecycle boundaries, sharing
measurement policy instead of duplicating it. They introduce no per-scroll scan
of the logical source. Comments explain unchanged-bounds and effect-replay cases.
No additional actionable code defect was confirmed during this pass.

## Remaining acceptance work

These are validation gaps, not additional confirmed defects:

1. Verify reset/revision-gap recovery on a current native build with unchanged
   content, delayed native callbacks and repeated replacement. Mocked native
   tests now establish scheduling and application, but not the real bridge.
2. Refresh native scroll/anchor checks: variable-size distant jumps, prepend
   during imperative scroll, end following during append, and source replacement
   with callbacks pending. Earlier iOS evidence in `fenwick-acceptance.md`
   predates this candidate. Android, legacy-native and macOS scrollbar behavior
   still require their platform-specific acceptance runs.
3. Profile production frame time and memory for intended shipping workloads
   before making end-to-end performance claims. Algorithm benchmarks alone do
   not substantiate those claims; this is a performance-evidence follow-up.

**100% happy: No** for unrestricted cross-platform shipping. The first two items
are the remaining acceptance blockers; there is no further confirmed code fix
on the current review list. Passing automated checks cannot establish behavior
on native runtimes that were not exercised in this pass.
