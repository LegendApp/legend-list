## Plan
Use the current `deferred-positions` branch only as a behavior oracle, then rebuild the optimization cleanly from `web` with the smallest surface that still satisfies the locked contract.

## Constraints
- Do not change the final user-visible behavior for supported paths.
- Keep oracle work focused on executable behavior, not branch cleanup.
- Prefer tightening focused tests over preserving incidental internal structure.
- Rebuild from `web` only after the oracle suite is green and committed.
- If the rebuild exposes an ambiguous contract, stop and add or refine tests on the oracle branch first.

## Verification
- Focus first on deferred-position, MVCP, imperative scroll, and container-position tests.
- Use broader validation after the rebuild lands: `bun test`, `bun run build`, and `bun run lint`.
- Keep manual checks noted for `bidirectional-infinite-list`, `chat`, `countries`, and `accurate-scrollto`.

## Steps
- [x] Refresh and extend focused oracle tests on the current branch for deferred-position and MVCP interactions.
- [x] Run the oracle verification suite until it passes and commit the tested contract.
- [x] Rebuild the deferred-position optimization from `web` with only the minimal logic needed to satisfy the oracle tests.
- [x] Run final validation, document remaining manual checks, and confirm the plan is complete.
