## Plan

Remove the remaining legacy initial-scroll strategy by making bootstrap-reveal the only implementation for `initialScrollIndex` and `initialScrollAtEnd`, while keeping `initialScrollOffset` as a separate direct-offset path.

- keep the public API unchanged
- make bootstrap-reveal the only strategy for index-based and end-based initial scroll
- treat `initialScrollOffset` as its own simpler path, not part of bootstrap and not part of legacy
- keep `initialScrollOffset` replay behavior, but make it issue the raw requested offset without pre-clamping
- treat observed scroll position as the source of truth after an offset-only request settles
- delete legacy strategy state, flags, and compatibility branches after the direct-offset path is isolated

## Decisions

- `initialScrollIndex` and `initialScrollAtEnd` are bootstrap-owned only; legacy retry semantics are not a target to preserve
- `initialScrollOffset` remains supported as a distinct path
- `initialScrollOffset` should issue the raw requested offset rather than pre-clamping in LegendList
- offset-only replay behavior remains supported for now, including empty-mount data-arrival replay
- if the requested offset exceeds the real scrollable range, final internal state should reflect the observed settled scroll position, not the raw requested value
- cleanup should proceed in two implementation phases:
  1. isolate and lock the direct-offset path
  2. delete legacy index/end behavior and strategy scaffolding

## Goals

- remove the remaining reliance on the old index/end initial-scroll behavior
- make the ownership boundary obvious: bootstrap for index/end, direct offset for offset-only
- reduce misleading "legacy" naming from code and tests
- keep offset-only behavior explicit and easy to reason about
- preserve bootstrap edge-case coverage for zero-target, empty-at-end rearm, footer invalidation, and data-change restarts

## Non-Goals

- no public prop changes
- no attempt to fold `initialScrollOffset` into bootstrap-reveal in this cleanup
- no attempt to preserve older visible-retry behavior for `initialScrollIndex` or `initialScrollAtEnd`
- no effort to make oversized offset-only requests deterministic across platforms beyond storing the observed settled position

## Risks

- removing pre-clamp from `initialScrollOffset` means oversized offset requests will be partly platform-defined at request time
- some current tests still encode older legacy-oriented expectations and must be rewritten before they can serve as a reliable regression suite
- offset-only replay behavior will still keep some complexity in the direct-offset path even after legacy deletion

## Implementation Model

### Phase 1: Isolate Direct Offset

Make offset-only initial scroll its own explicit implementation path:

- detect offset-only targets without routing them through a `legacy` strategy
- issue raw requested offsets for offset-only initial scroll
- keep replay behavior for offset-only cases where the list mounts before data or layout is ready
- after scroll settles, rely on the actual observed scroll position as internal state
- update tests so offset-only behavior is described in these terms instead of "legacy"

### Phase 2: Delete Legacy Index/End Strategy

After the direct-offset path is isolated:

- remove the old non-bootstrap branches for `initialScrollIndex` and `initialScrollAtEnd`
- keep bootstrap lifecycle ownership for:
  - zero-target fast path
  - empty `initialScrollAtEnd` finish-and-rearm behavior
  - footer invalidation
  - data-change restart
  - native/web final correction
- remove strategy state, unions, flags, and test scaffolding that exist only to switch between `legacy` and `bootstrapReveal`

## Step Boundaries

- [x] Add or rewrite focused tests so they lock the intended post-cleanup contracts:
  - bootstrap is canonical for `initialScrollIndex` and `initialScrollAtEnd`
  - offset-only behavior is defined as raw request + replay retained + observed settled state wins
  - stale assertions that the default strategy is `legacy` are removed

- [ ] Isolate `initialScrollOffset` into an explicit direct-offset path in `LegendList`:
  - stop treating offset-only behavior as a legacy strategy selection
  - remove pre-clamp from the offset request path
  - keep replay behavior
  - ensure final state is based on observed settled scroll

- [ ] Narrow the strategy boundary so bootstrap ownership applies only to index/end initial scroll:
  - simplify or replace `resolveInitialScrollStrategy`
  - make non-bootstrap cases mean "no bootstrap session" rather than "legacy strategy"

- [ ] Delete the remaining legacy runtime branches for `initialScrollIndex` and `initialScrollAtEnd` while preserving bootstrap edge-case handling

- [ ] Remove legacy strategy types, flags, overrides, mock defaults, and leftover naming from source and tests

- [ ] Run focused verification and record the outcome:
  - initial-scroll component tests
  - initial-scroll integration tests
  - initial-scroll prop behavior tests
  - `calculateItemsInView`
  - `checkFinishedScroll`
  - `finishScrollTo`
  - `setDidLayout`
  - `tsc:src`
  - one manual oversized-`initialScrollOffset` smoke check

## Verification

Focused verification target:

- `bun test __tests__/components/bootstrapInitialScroll.test.ts __tests__/components/LegendList.bootstrapInitialScroll.test.tsx __tests__/components/LegendList.initialScroll.integration.test.tsx __tests__/components/LegendList.props.test.tsx __tests__/components/LegendList.initialScrollThresholds.test.tsx __tests__/core/calculateItemsInView.test.ts __tests__/core/checkFinishedScroll.test.ts __tests__/core/finishScrollTo.test.ts __tests__/utils/setDidLayout.test.ts --timeout 15000`
- `bun run tsc:src`
- manual smoke pass:
  - one long `initialScrollIndex` example
  - one `initialScrollAtEnd` chat-style example
  - one oversized `initialScrollOffset` example to confirm raw request plus observed settled state behavior

## Cleanup End State

When this plan is complete:

- `legacy` is no longer an initial-scroll strategy in runtime code
- bootstrap-reveal fully owns `initialScrollIndex` and `initialScrollAtEnd`
- `initialScrollOffset` remains as a distinct direct-offset path
- tests describe behavior in terms of bootstrap ownership and offset-only contracts rather than old/new strategy comparison
