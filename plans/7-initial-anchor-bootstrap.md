## Plan
Replace the current initial-scroll retry/state-machine stack with a dedicated anchor-bootstrap flow that keeps the target item visually fixed while measurements settle. Keep the first version intentionally narrow: `initialScrollIndex` and `initialScrollAtEnd` only, single-column only, and one final absolute reconcile at the end.

## Constraints
- Remove the existing initial-scroll replay/retry machinery only when the replacement path covers the same user-visible behavior for supported cases.
- Do not try to solve `initialScrollOffset` with the new architecture in v1; keep it on a separate path or preserve the current simpler behavior until a follow-up.
- Keep the first version disabled for unsupported shapes: multi-column, sticky headers, horizontal lists, and any path that cannot guarantee anchor ownership.
- Prefer replacing whole subsystems cleanly over preserving compatibility shims that keep old and new initial-scroll logic alive at the same time.
- If a step exposes ambiguous behavior around empty-data mounts, footer compensation, or end clamping, stop and lock the contract down with tests before continuing.

## Target Architecture
- Introduce a single `initialAnchorSession`-style state owner for supported initial-scroll flows instead of spreading ownership across `initialScroll`, `scrollingTo`, watchdog state, `setDidLayout` replay, and old-arch anchor correction.
- Start supported initial-scroll flows with one estimated native scroll to the target anchor offset.
- During bootstrap, keep the anchor item visually fixed and accumulate pre-anchor measurement drift into a temporary bootstrap visual adjust instead of issuing repeated corrective scrolls.
- Finish bootstrap with one settle/commit path that either proves the estimated offset was already correct or performs one final non-animated absolute reconcile.
- Fall back early to a simpler non-bootstrap path for unsupported cases rather than stretching the anchor model across all existing shapes.

## Verification
- Add focused tests for each replacement slice before deleting the old path it supersedes.
- Keep regression coverage centered on supported contracts: mount with data, empty-to-nonempty rearm, footer-aware `initialScrollAtEnd`, clamp behavior, and settle completion without repeated scroll retries.
- Run broader validation after the rewrite lands: `bun test`, `bun run build`, and `bun run lint`.
- Manual checks still required in the example apps for `initial-scroll-index`, `initial-scroll-index-free-height`, and `initial-scroll-start-at-the-end`.

## Steps
- [ ] Lock the supported v1 contract in tests: define exactly which `initialScrollIndex` and `initialScrollAtEnd` behaviors the rewrite must preserve, plus which shapes explicitly fall back.
- [ ] Introduce the new bootstrap state model and target-normalization helpers so one subsystem owns initial-scroll lifecycle and settle state.
- [ ] Implement the anchor-bootstrap visual-adjust path for supported `initialScrollIndex` flows, using one estimated initial scroll and drift accumulation instead of repeated scroll retries.
- [ ] Extend the bootstrap path to `initialScrollAtEnd`, including footer-aware retargeting and one final absolute reconcile when tail clamp changes the true target.
- [ ] Remove the superseded initial-scroll replay/retry infrastructure (`setDidLayout` second-pass replay, legacy finish branching, old initial-anchor correction hooks where no longer needed) and simplify callers onto the new flow.
- [ ] Run broader validation, document any explicit fallbacks or deferred follow-ups, and record remaining manual example checks.
