## Performance improvements for web implementation

### High-impact (do these first)

1) Reduce initial container allocation
- Lower the extra multiplier used to compute initial `numContainers` on web (viewport + buffer only).
- Lower the initial pool size on web (`numContainersPooled`) to keep initial DOM small.
- Progressively warm up the pool after first paint (increase `numContainersPooled` via rAF/idle).

2) Batch initial state updates
- Batch all `set$` calls in initial allocation to avoid N intermediate renders.

3) Ensure only one initial calculate pass
- Prevent `doInitialAllocateContainers` and `handleLayout` from both calling `calculateItemsInView` during mount on web.

4) Limit size observation to “until stable”
- Observe item size changes only until stable across one or two frames; then stop observing.

### Medium-impact

- Prefer fixed or reliable estimated sizes to minimize measurements.
- Coalesce item size updates more aggressively during initial mount.
- Memoize `renderItem`/separators and avoid inline objects to reduce rerenders.
- For very large lists on web, increase `scrollEventThrottle` a bit (e.g., ~24–32ms).

### Low-risk CSS/DOM tweaks

- Keep DOM order static (transforms for movement).
- Only use `content-visibility: auto` on heavy inner nodes after sizes stabilize.


