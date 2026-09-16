# Sparse layout test coverage

The previously failing regressions are fixed and the combined release check
passes. A high line percentage alone does not establish release readiness.

## Reproduce the checks

```sh
bun run test:release
```

This runs the complete suite with changed-line coverage, source and public API
type tests, lint and build, built-package type tests, and the known regressions.
All checks pass on the fixed candidate. Run this command before publishing; the existing
publish commands do not invoke this new gate automatically.

Individual checks:

```sh
bun test
bun run test:coverage:branch                  # compare against merge-base(main, HEAD)
bun run test:coverage:branch other-base       # choose another comparison base
bun run tsc:src
bun run tsc:types
bun run build
bun run tsc:package-types                    # requires a current build
bun run test:regressions                     # requires a current build
```

## Verified snapshot

Verified on September 16, 2026, using Bun 1.3.14. Source target: `sparse-layout`
at `8f1d0318`, including the working-tree reset, adapter-identity and empty-viewport fixes and tests. Comparison base:
`e9f90bcfb4e8cce9111971f31d72d443d5989f0b`.

- Default suite: **1,947 passing tests**, 146 files, 1,664,960 assertions.
- Changed executable lines: **3,318 / 3,334 (99.52%)**, with the Bun normalization
  described below. This passes the 95% changed-line threshold.
- No unmeasured runtime changes were found.
- Source types, public API types, built-package types, lint and build pass.
- All 42 focused mounted regression cases pass, alongside the continuous-time
  unit tests. Public inference tests pass against source and generated declarations.

These are line-coverage numbers for changes on a Git branch, not measurements of
every boolean branch, condition, state transition, or possible event ordering.

## Behavioral coverage

| Area | Coverage and assertions |
| --- | --- |
| Sparse sequence and row stores | Shared contract tests compare offsets, sizes, totals, measured counts, averages and offset lookup against a separate dense model. Twenty additional seeded runs exercise 20,000 mutation steps across single-column and three-column stores. Existing tests cover large sparse collections, split/merge boundaries, cached versus measured sizes, invalidation, zero sizes and span topology. Both stores have 100% measured changed-line coverage. |
| Source mutations | Observer validation plus coordinator tests cover malformed revisions/ranges, reset requests, key read failures, duplicate or changed keys, identity retention, removal, moves, target transformation, viewability notifications and variable-span invalidation. Mounted-list tests verify recovery from reset, revision gaps and changed keys, followed by a valid mutation. Observer and coordinator have 100% measured changed-line coverage. |
| Span array operations | Exhaustive small splice/move shapes preserve known and unknown spans in both directions. A 200,000-entry insertion/move/removal checks engine argument-limit avoidance. |
| Estimates and anchoring | Lifecycle tests cover initial and periodic estimate updates, stale anchor clamping, visible/buffered fallback anchors, deferral without an anchor, scroll activity and zero-size exclusions. Mounted coverage verifies unloaded source items are not passed to the loaded-item restoration callback. |
| Measurement | Native tests cover synchronous batching, delayed callbacks, generations, assignment changes, fixed-size skipping, unloaded slots and reveal state. Web and legacy measurement cases run in fresh processes and contribute their own coverage. Reset/source-replacement ownership now has passing mounted regressions. |
| Rendering and scrolling | Mounted prop and bootstrap tests cover source lifecycle, prepend, same-length changes, window allocation, RTL, initial targets, footer/header changes and macOS transient viewport measurements. Imperative tests cover array/source reference lookup, absent items, visible items and scrolling above/below the viewport. |
| Public types | Web, native, Reanimated, keyboard and legacy keyboard wrappers verify explicit source generics and inferred arrays across first-visible, size, viewability and configured viewability callbacks. Negative type assertions detect accidental `any` or loss of unloaded-item optionality. The same consumer tests compile against generated declarations. SectionList inference is covered separately. Inferred-source callbacks also pass for every listed wrapper. |
| Test tooling | Coverage parser tests verify path/query normalization, counter union, phantom zero handling, diff line selection and detection of runtime versus erased-type changes. |

The latest regression expansion adds:

- Twelve mounted native measurement scenarios cover explicit reset, revision gaps
  and changed-key recovery across both axes and one/two columns. Each repeats
  recovery twice and verifies exact offsets, zero-size rows and fresh measurements
  equal to the previously cached values.
- Nineteen mounted timing scenarios cover parent rerenders, changed callbacks,
  equivalent configurations, extra data, preserved payload updates, source
  reset/replacement and empty-footer exit/reentry. Both cached and full layout
  paths verify exact continuous-visibility deadlines and exit notifications.
- Stable array/source adapters preserve pending timers and avoid repeating a
  1,000-item variable-span scan on unrelated rerenders. Pinned keys and bottom
  rows remain correct after moves, appends and removal.
- Five additional seeded variable-span models compare 2,500 mixed measurements,
  splices, moves, invalidations, estimate changes, span edits and column changes
  against independently rebuilt dense geometry after every operation.

## Resolved regressions

Every runtime regression now lives under `__tests__/components/` and runs in a
fresh process launched by the default suite. Public inference assertions live in
`__tests__/types/publicInference.types.tsx` and compile against both source and
built declarations. `test:regressions` remains a convenient focused recheck.

| Commit | Fix and regression |
| --- | --- |
| `3f9acf2b` | Reset/replacement measurement ownership: reject obsolete callbacks immediately, including revision-gap recovery, while accepting fresh measurements. |
| `7e89e9df` | Sibling visibility subscriptions: replay the current value at subscription and deliver future events to the latest callback without duplicate initialization. |
| `50635a65` | Source callback inference: preserve item types across five public wrappers and preserve the array/source distinction in exported animated props. |
| `8d03e066` | Interaction gating: honor `waitForInteraction` and expose `recordInteraction`, covering explicit recording, dragging and scrolling. |
| `2ef78859` | Minimum visible time: track continuous eligibility per key/configuration, with one pending timer per configuration. Cover leave/reentry, threshold changes, callbacks, resets, removal/reinsertion and disposal. |

The two timing defects also existed on main; their fixes are included here.

The latest fixes clear keyed native-size caches together with reset geometry,
retain indexed adapters across unrelated renders, and process empty item viewports
as visibility exits. The empty-viewport defect also reproduced on main; the array
rerender defect did not.

## Coverage collection and limits

`scripts/branch-coverage.ts` runs the full suite, the platform child-process cases,
and each mounted prop/bootstrap scenario separately. The latter suites import
fresh query-suffixed modules; a single Bun process can retain only one instance's
coverage counters for a source path. Independent runs recover the other paths.
Scenario names come from actual passing test output, including parameterized
tests, and each isolated run must execute at least one test.

The collector merges positive counters by normalized source path. Bun also emits
zero counters for entire uncalled source ranges, including blank lines and erased
TypeScript declarations. Once those functions execute, those non-executable lines
are omitted. The normalized denominator keeps lines present across the records,
plus every line with any positive counter. The raw union remains available for
audit: this snapshot reports 3,690 raw lines, including 356 such phantom zeroes.
The resulting percentage is a Bun-normalized estimate, not an independent
instrumentation result.

Reports and all 158 individual LCOV files/logs are written to
`coverage/branch/`. `summary.json` and `summary.md` list uncovered changed lines by
file. Type-only changes are checked through compilation; changed runtime files
with no coverage cause the gate to fail. Working-tree changes, including
untracked source files, are included. A failing test or less than 95% normalized
changed-line coverage also fails the command. Generated reports are gitignored.

Sixteen changed lines remain unhit in the passing runs, in list orchestration,
initial scrolling, mounted-container synchronization and viewability fallback paths; the generated report
contains their exact locations. Passing tests around those areas do not prove
every fallback or lifecycle ordering is exercised.

Fresh device/browser acceptance remains necessary on the fixed candidate:
native delayed measurement and rapid reset/replacement, all sibling visibility
hooks, both timing modes, and scroll/anchor behavior on the built candidate.
The previous web example typecheck also remains blocked by missing local example
dependencies. This testing pass does not resolve that environment gap or replace
native/web UI and performance acceptance.

For this latest pass, Argent reported no running device or Chromium target.
The worktree has native JS dependencies but no generated iOS/Android project;
the web example still lacks its dependencies. No live UI acceptance was run.

## Scrollbar and measurement integration regression

`bun test ./__tests__/components/LegendList.scrollbarMeasurements.test.ts`
runs the mounted list in an isolated process. The native view boundary is mocked;
scroll handling, delayed native measure callbacks, measurement batching, layout,
scroll adjustments, and recycled container assignment use the real source code.
The scenario covers 86,016 rows with both arrays and indexed sources, shrinking
and growing rows, and ten large jumps/reversals per data mode. Assertions check
native/rendered offset agreement, destination indices, every visible container's
assignment, and stability after the former 100 ms suppression window.

This test runs in the default suite, focused release regressions, and isolated
branch coverage collection. Restoring the original missing item-size adjustment
source makes both data modes fail on native/rendered offset disagreement.
It protects event ordering and rendered range selection, not AppKit painting or
physical scrollbar tracking. The 10 MB Markdown macOS thumb-drag check remains
separate runtime acceptance; these tests do not claim automated pixel coverage.
