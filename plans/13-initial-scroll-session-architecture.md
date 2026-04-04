## Plan

Refactor initial-scroll architecture around one explicit session owner so bootstrap, offset-only replay, layout readiness, and completion all flow through a single state machine instead of scattered flags and helper coordination.

- treat initial scroll as one lifecycle concept with one owner
- make `LegendList` an event source, not a coordinator of initial-scroll internals
- keep `calculateItemsInView` focused on generic viewport/range computation
- preserve current public behavior while deleting ownership leaks and impossible state combinations
- prefer fewer states and fewer cross-module branches over more helper extraction

## Decisions

- no public API changes
- no class/manager framework; use plain functions around one explicit session object
- bootstrap remains the implementation for index-based and end-based initial scroll
- offset-only initial scroll remains a separate direct-offset kind inside the same session model
- the target architecture should reduce hot-path branching, not just move it between files
- tests should shift toward session-boundary behavior, with low-level math tests retained only where they add signal

## Goals

- represent initial-scroll lifecycle as one discriminated session object
- remove bootstrap-specific policy from `calculateItemsInView`
- centralize initial-scroll completion ownership instead of splitting it across dispatch/progress/fallback/finalize helpers
- make `LegendList` emit mount/layout/data/footer/scroll events into the session owner
- reduce `InternalState` flag soup and impossible combinations

## Non-Goals

- no behavior redesign for bootstrap settle semantics
- no broad MVCP or allocator refactor in the same change set
- no public prop cleanup or rename work
- no speculative abstractions for future scroll features beyond what this lifecycle needs

## Risks

- this changes ownership, not just file boundaries, so timing regressions are possible even if tests stay green
- the session owner will need to preserve platform quirks like silent native scroll retries and web extra-frame completion
- if the plan tries to collapse state and hot-path ownership in one step, regressions will be harder to localize
- if helper-level tests are deleted too early, the branch can lose useful failure localization during the refactor

## Target Shape

### Session State

Introduce one `initialScrollSession` object in `InternalState` with explicit variants:

- `kind: "offset"` for offset-only initial scroll
- `kind: "bootstrap"` for index/end initial scroll
- `phase` values that describe lifecycle ownership directly, for example:
  - `pending`
  - `waitingForLayout`
  - `measuring`
  - `scrolling`
  - `settling`
  - `finished`

The session should own:

- target and resolved offset
- bootstrap reveal snapshot / seed / pass counts
- footer-preservation state
- native watchdog / silent-dispatch retry state
- replay metadata needed for empty-mount data arrival

### Module Boundaries

- `LegendList.tsx`
  - create the session from props
  - forward lifecycle events only
  - stop mutating initial-scroll state directly outside session APIs

- `initialScrollSession.ts` or equivalent core module
  - own state transitions
  - own bootstrap rearm / finish / abort decisions
  - own completion policy
  - consume viewport facts and scroll progress events

- `calculateItemsInView.ts`
  - compute viewport/range facts only
  - stop deciding bootstrap suppression policy directly
  - expose any facts the session needs as inputs/outputs rather than peeking at bootstrap state

- `scrollTo.ts`, `onScroll.ts`, `checkFinishedScroll.ts`, `finishScrollTo.ts`
  - become primitive adapters that report dispatch/progress/completion events to the session owner
  - stop owning lifecycle transitions directly

## Implementation Model

### Phase 1: Define the Session Model

Add the explicit session shape without removing existing behavior yet.

- introduce a discriminated `initialScrollSession` type
- map existing state into session fields
- keep old fields temporarily only where needed for compatibility during migration
- add focused tests for session creation and transition invariants

Success criteria:

- the session shape can express all current initial-scroll modes
- impossible combinations are identified and no longer need defensive checks in new code
- the migration can proceed with old behavior preserved

### Phase 2: Move Completion Ownership Into the Session

Centralize scroll dispatch/progress/fallback/finalize logic.

- route `scrollTo`, `onScroll`, fallback checks, and `finishScrollTo` through session transitions
- move watchdog and silent-retry state under the session
- keep platform quirks but localize them behind session-owned predicates/actions

Success criteria:

- completion logic has one owner
- scattered flags like dispatch/progress/retry/watchdog no longer drive behavior independently
- `finishScrollTo` does not need to understand initial-scroll policy

### Phase 3: Move Bootstrap Ownership Out of the Hot Path

Make bootstrap consume viewport facts rather than embedding policy in `calculateItemsInView`.

- replace bootstrap-specific branching in `calculateItemsInView` with a narrower fact interface
- let the session decide when to suppress side effects, when to re-run, and when to settle
- preserve the current seeded reveal-window behavior and convergence bounds

Success criteria:

- `calculateItemsInView` does not branch on bootstrap session state directly
- bootstrap evaluation is triggered by the session owner using computed facts
- the hot path reads as generic list logic again

### Phase 4: Shrink `LegendList` to Event Wiring

After ownership has moved:

- remove remaining initial-scroll orchestration from `LegendList`
- keep prop normalization and event forwarding only
- ensure footer/data/layout hooks call session entrypoints rather than direct helper combinations

Success criteria:

- `LegendList` is readable without understanding initial-scroll internals
- most initial-scroll tests no longer need to reach through component-local orchestration details

### Phase 5: Delete Transitional State and Rebalance Tests

Only after the new owner is stable:

- remove old state fields and compatibility shims
- delete tests that only assert helper choreography
- keep boundary tests for offset-only replay, bootstrap convergence, footer rearm, silent native retry, and finish timing

Success criteria:

- `InternalState` no longer has parallel old/new initial-scroll representations
- helper-level tests are reduced in favor of session-boundary coverage
- the final code is smaller or clearly simpler

## Step Boundaries

- [x] Add this plan file and align on the target architecture before coding

- [x] Introduce the explicit initial-scroll session type and migrate source/tests to read from it without changing runtime behavior yet

- [x] Move completion ownership into the session:
  - dispatch tracking
  - native watchdog
  - silent retry
  - fallback completion
  - final finish options

- [x] Move bootstrap convergence and rearm ownership behind the session and remove bootstrap policy branches from `calculateItemsInView`

- [x] Shrink `LegendList` to session wiring only and remove remaining initial-scroll orchestration helpers that no longer add value

- [ ] Remove transitional fields/shims and rebalance tests around session-boundary behavior

- [ ] Run focused verification and record the outcome:
  - `bootstrapInitialScroll`
  - `LegendList.bootstrapInitialScroll`
  - `LegendList.initialScroll.integration`
  - `checkFinishedScroll`
  - `finishScrollTo`
  - `calculateItemsInView`
  - `tsc:src`

## Verification

Focused verification target:

- `bun test __tests__/components/bootstrapInitialScroll.test.ts __tests__/components/LegendList.bootstrapInitialScroll.test.tsx __tests__/components/LegendList.initialScroll.integration.test.tsx __tests__/core/checkFinishedScroll.test.ts __tests__/core/finishScrollTo.test.ts __tests__/core/calculateItemsInView.test.ts --timeout 15000`
- `bun run tsc:src`

Expected review checks after each major phase:

- is ownership actually more centralized, or did the same behavior move behind more wrappers?
- did the hot path get simpler?
- did the state model remove impossible combinations?
- did `LegendList` get smaller in a meaningful way?

## Cleanup End State

When this plan is complete:

- initial scroll has one explicit session owner
- bootstrap and offset-only flows are variants of the same lifecycle model, not scattered special cases
- `calculateItemsInView` is generic viewport logic rather than a bootstrap coordinator
- `LegendList` is an event wiring layer
- completion/watchdog behavior is centralized and easier to reason about
