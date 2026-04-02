## Plan

Refactor bootstrap initial-scroll internals so the logic is easier to read and lives behind a smaller boundary, while avoiding new abstraction layers or behavior changes.

- keep the current bootstrap behavior intact
- simplify ownership so one core module owns bootstrap mutations and decisions
- keep `LegendList` focused on orchestration and wiring
- reduce bootstrap state to the minimum needed to preserve behavior
- prefer plain functions and deleted code over new layers

## Decisions

- no public API changes
- no strategy classes, managers, or additional indirection beyond plain functions in one core module
- preserve the current cumulative mount-level watchdog behavior
- keep the refactor incremental so each slice can be validated and committed safely

## Goals

- make bootstrap logic understandable by reading one core module plus a few call sites
- remove direct bootstrap session mutation from `LegendList` where practical
- simplify finish and fallback ownership so bootstrap state drives bootstrap completion
- remove callback-style cross-module control flow when a direct function call is enough

## Non-Goals

- no behavior changes to bootstrap settle/rearm semantics
- no broad initial-scroll redesign
- no attempt to unify offset-only initial scroll with bootstrap
- no new debugging or diagnostics surface

## Risks

- bootstrap behavior is spread across `LegendList`, `calculateItemsInView`, `finishScrollTo`, and fallback logic, so moving ownership can accidentally change timing
- collapsing state fields too early can blur whether a regression came from architecture changes or state simplification
- over-refactoring can make the code "cleaner" on paper but harder to follow in practice

## Refactor Model

### Phase 1: Consolidate Ownership

Move bootstrap-only behavior into one core module:

- frame ticker
- convergence evaluation
- corrective finish path
- abort path
- shared predicates used by scroll completion

The target shape is plain functions in `src/core`, not a class or framework.

### Phase 2: Shrink Call Sites

After the bootstrap core owns the logic:

- `LegendList` should decide whether to start or rearm bootstrap
- `calculateItemsInView` should call bootstrap evaluation directly
- finish/fallback code should ask bootstrap state questions without re-implementing bootstrap behavior

### Phase 3: Simplify State

Only after ownership is consolidated:

- remove redundant fields that duplicate phase-driven meaning
- prefer phase-based state over extra booleans
- keep only the data needed to drive measurement, correction, and final reveal

## Step Boundaries

- [ ] Add this plan file and commit it

- [ ] Consolidate bootstrap evaluation, ticker, and finish/abort helpers into one core module while preserving behavior

- [ ] Shrink `LegendList` to bootstrap orchestration only and remove direct mutation of bootstrap internals where practical

- [ ] Simplify bootstrap session state and remove callback-style evaluation wiring

- [ ] Run focused verification and record the outcome:
  - `bootstrapInitialScroll`
  - `LegendList.bootstrapInitialScroll`
  - `LegendList.initialScroll.integration`
  - `calculateItemsInView`
  - `checkFinishedScroll`
  - `finishScrollTo`
  - `tsc:src`

## Verification

Focused verification target:

- `bun test __tests__/components/bootstrapInitialScroll.test.ts __tests__/components/LegendList.bootstrapInitialScroll.test.tsx __tests__/components/LegendList.initialScroll.integration.test.tsx __tests__/core/calculateItemsInView.test.ts __tests__/core/checkFinishedScroll.test.ts __tests__/core/finishScrollTo.test.ts --timeout 15000`
- `bun run tsc:src`

Recorded outcome:

- pending

## Cleanup End State

When this plan is complete:

- bootstrap internals are primarily readable in one core module
- `LegendList` is an orchestrator, not the owner of bootstrap internals
- bootstrap completion paths rely on simpler, phase-driven state
- the resulting code is smaller or at least materially clearer without extra architecture
