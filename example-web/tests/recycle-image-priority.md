# Recycled image request priority

## Run the fixture

From `example-web`, run `bun run dev:fixtures --port 5188`, then open
[Recycled Image Priority](http://localhost:5188/recycle-image-priority).

Choose **60 ms (very slow)**, restart at the top, and scroll down by four rows
several times. Reverse upward, then try **Restart at end**. Each image is a real,
local HTTP request with `Cache-Control: no-store`, a unique session URL, and a
400 ms response delay. The side panel uses Resource Timing **startTime**, not
response completion order. This endpoint is provided by the Vite dev server;
use the fixture dev command rather than a static production preview.

The 480 px viewport contains four 120 px rows, with a 360 px draw distance.
Rows deliberately spend 25 or 60 ms rendering. The development app uses React
StrictMode, which can repeat that render work. Images use ordinary eager `img`
elements; the fixture does not implement its own loading queue or priority sort.

## Automated replay

With Playwright and Chrome available:

```sh
node example-web/tests/recycle-image-priority.mjs
```

Run from the repository root. If Playwright is outside the project, set
`PLAYWRIGHT_MODULE` to its absolute `index.mjs` path. Optional environment variables:

- `FIXTURE_URL`: server origin (defaults to `http://127.0.0.1:5188`).
- `RESULT_PATH`: write the observed request sequences to JSON.
- `SCREENSHOT_PATH`: save the final fixture screenshot.
- `OBSERVE_ONLY=1`: collect a baseline without asserting the expected ordering.

The replay observes browser network requests independently of the fixture's
Resource Timing log. It checks initial top/end placement, four fast 480 px wheel
steps, two upward reversals after pauses, and an upward step from the end.

It also sends continuous six-event wheel bursts **in both directions**, with no
settling between events and 60 ms row rendering. Each recycled assignment has a
unique image URL. Row layout effects record those URLs, and a React Profiler
callback publishes each commit boundary. The test matches actual browser network
requests to those commits and asserts directional request order **within every
batch**. It rejects unmatched requests and duplicate assignment records, and
requires at least two batches with multiple requests per direction. StrictMode's
replayed mount effects are excluded from the assignment trace.

## Observed before/after results

Validated on 2026-09-15 in headless Chrome, 1440 × 1000, with the same fixture and
60 ms row cost. The baseline used `findAvailableContainers.ts` from `e9f90bcf`,
loaded by a separate Vite server; the working source was not replaced.

| Scenario | Old allocator: request order | New allocator: request order |
| --- | --- | --- |
| Fourth downward wheel step | 21, 18, 19, 20 | 18, 19, 20, 21 |
| First upward reversal | 7, 10, 9, 8 | 10, 9, 8, 7 |
| Start at end | 491 → 499 | 499 → 491 |
| Upward wheel step from end | 489, 488, 487, 490 | 490, 489, 488, 487 |

The baseline failed four directional-order checks; the updated allocator passed
all ten. Initial top ordering remained ascending. Resource Timing independently
confirmed the final upward order `490, 489, 488, 487`.

### Follow-up validation (2026-09-16)

Both continuous-burst assertions fail against the old allocator with no unmatched
requests or duplicate assignment records, and pass against the updated allocator.
All twelve browser ordering scenarios pass, including the two continuous bursts.
The library suite passes 1,694 tests, including new regressions for always-render
and scroll-target pin priority in both scroll directions. Source/web typechecks,
lint, and the library build also pass.

This establishes request initiation **order**, not a guaranteed time saving,
network scheduling priority, or reduced blanking. Recycled image updates may start
within the same commit and share the browser's timestamp precision. Native image
loading was not measured on a device. Library tests cover allocation constraints
and initial-scroll rendering on the native component path.

Buffered-window requests take priority over distant always-render and scroll-target
pins; each group is ordered by direction. Ordering applies within each requested
item type and sticky/normal pool. Exact
type reuse, protected slots, distance-based slot selection, and pool growth retain
their existing behavior. Existing visible rows are not reassigned just to sort
physical slots.
