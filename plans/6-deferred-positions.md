## Plan
Rebuild deferred position handling from `web` in small, behavior-first commits so regressions can be isolated quickly. Keep the first version intentionally narrow: single-column only, source-tracked size shifts only, and explicit flush points only.

## Constraints
- Do not port `deferredPositionBaseline`, candidate collection, majority-vote matching, or other container-baseline state from the abandoned branch.
- Keep the optimization disabled for unsupported shapes: multi-column, sticky headers, horizontal lists, initial scroll, and imperative scroll ownership.
- Prefer additive commits with focused tests over broad refactors.
- If a commit breaks a core path in tests or examples, stop and fix or revert that slice before continuing.

## Verification
- Run focused tests for each step before committing.
- Use broader validation after behavior slices land: `bun test`, `bun run build`, and `bun run lint`.
- Manual example checks still pending: `countries`, `chat`, `bidirectional-infinite-list`, and `accurate-scrollto`.

## Steps
- [x] Add the minimal deferred position state for a source-tracked pending size shift and wire initial/reset state.
- [x] Accumulate above-viewport measured size diffs in `updateItemSize` and cover that path with focused tests.
- [x] Apply the deferred position delta during supported calculate passes without baseline tracking or voting.
- [x] Rebase or discard deferred state at explicit boundaries: data change, unsupported layout, and imperative scroll start.
- [x] Add boundary and cap flushing for deferred position state with focused regression coverage.
- [x] Run broader validation and record any remaining manual example checks.
