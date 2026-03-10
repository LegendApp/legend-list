# Potential Simplifications

These are plausible cleanup ideas, but they are not the focus of the current branch-owned simplification pass.

## Sticky/Container Flow

- Replace the `getActiveStickyIndices` `Array.from(...).map(...).map(...).filter(...)` chain in `src/core/calculateItemsInView.ts` with a single loop over `stickyContainerPool`.
- Remove the duplicate `activeStickyIndex` write so one code path owns that state.
- Introduce a small local helper for "enqueue index if not already mounted" to reduce repeated sticky/buffered/always-render container-allocation checks.

## Container Update Flow

- Revisit whether the staged `containerUpdates` array in `src/core/calculateItemsInView.ts` can be reduced further without making shared-origin resolution harder to reason about.
- Consider whether sticky recycling and pending-removal cleanup can be made more local to container allocation/release helpers.

## Shared Origin

- Consider replacing the temporary shared-origin delta array with in-pass counting if that remains readable after the branch-owned simplifications are done.
