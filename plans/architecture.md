## Plan

Tighten the initial-scroll, MVCP, and deferred-geometry architecture so ownership is explicit, state is minimal, and hot-path orchestration stays centralized without adding heavier runtime layers.

## Goals

- Keep scroll-stability ownership explicit and derived from a small set of authoritative state.
- Reduce overlapping startup and deferred-geometry state so the code is easier to reason about.
- Keep `calculateItemsInView` as the central orchestrator while reducing duplicate hot-path policy checks.
- Reduce local policy branching in `updateItemSize` so measurement handling follows the same ownership model as the rest of the system.
- Break import cycles between startup, deferred geometry, and ownership modules so boundaries are clearer and runtime/module churn is lower.
- Reduce the number of authoritative startup booleans and duplicated deferred-eligibility predicates.
- Preserve current cap policy and flush semantics in this pass.

## Non-Goals

- Do not redesign anchor-relative cap logic in this pass.
- Do not redesign deferred flush modes in this pass.
- Do not introduce a heavyweight controller or class hierarchy.
- Do not broaden behavior changes beyond architecture tightening and ownership cleanup.

## Target Architecture

- `src/core/scrollOwnership.ts` is the single source of truth for who owns scroll stability.
- `src/core/initialBootstrap.ts` owns startup-only phases, target state, and transitions.
- `src/core/deferredPositionState.ts` owns deferred-geometry-only state and transitions.
- `src/core/calculateItemsInView.ts` orchestrates passes and consumes shared helpers instead of inlining subsystem policy.
- `src/core/updateItemSize.ts` classifies measurement impact and delegates ownership-sensitive behavior instead of making broad local policy decisions.
- `src/utils/setInitialRenderState.ts` becomes a pure readiness sink driven by startup-owner completion rather than a place that carries startup policy.

## Implementation Outline

- Collapse remaining startup/readiness meaning into a smaller startup phase model with less overlapping meaning across `initialScroll`, bootstrap phase, `didFinishInitialScroll`, `queuedInitialLayout`, and initial-scroll-specific `scrollingTo` state.
- Remove or fold overlapping internal fields that no longer carry distinct meaning.
- Make startup-active and startup-done checks come from one small shared startup helper surface, and keep `setInitialRenderState` as a pure sink for those results.
- Break import cycles between ownership, bootstrap, and deferred-state modules while keeping ownership predicates dependency-light and reducing dependencies rather than replacing them with extra indirection.
- Centralize deferred-pass activation and rebase policy under the ownership model so one path decides whether deferred geometry is active for a pass.
- Remove duplicate deferred-eligibility predicates by folding `canUseDeferredGeometry` into the same ownership-centered path, or reducing it to a trivial wrapper over that source.
- Continue narrowing `updateItemSize` so it classifies measurement impact and routes through shared ownership decisions instead of ad hoc conditions.
- Tighten startup readiness so it derives from owner completion rather than scattered booleans.

## Guardrails

- Keep hot-path runtime work minimal; prefer tiny pure helpers over additional stateful layers.
- Avoid behavior drift in cap policy and deferred flush semantics while tightening ownership boundaries.
- Preserve current bootstrap, MVCP, and deferred-geometry contracts unless a change is explicitly part of the plan.
- Remove dead state aggressively when it no longer participates in runtime behavior.
- Do not introduce extra abstraction layers whose main effect is moving code without reducing state overlap or branch count.
- Prefer dependency reduction over helper proliferation when breaking cycles.
- Keep readiness and ownership code out of new cycles.

## Tests

- Add or update focused tests around ownership transitions rather than only delta values:
  - bootstrap owns startup passes
  - startup cleanly yields to steady-state scrolling
  - MVCP-owned size changes route to MVCP
  - deferred-geometry-owned size changes stay deferred
  - ownership changes clear or rebase state correctly
- Continue validating with focused core suites around:
  - `calculateItemsInView`
  - `updateItemSize`
  - `deferredPositionState`
  - bootstrap/startup behavior
- Run `bun run tsc:src` after each architectural step.

## Steps

- [x] Unify remaining startup/readiness state around a smaller startup phase model, remove overlapping fields, and make readiness derive from one startup-owner completion surface.
- [x] Break import cycles between ownership, bootstrap, and deferred-state modules by reducing dependencies, not by adding extra indirection.
- [ ] Centralize deferred-pass activation/rebase policy under the ownership model and remove duplicate deferred-eligibility and gating logic.
- [ ] Narrow `updateItemSize` further so measurement handling follows shared ownership rules with less local branching.
- [ ] Tighten tests around owner transitions and verify the focused architecture suite.
