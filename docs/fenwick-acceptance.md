# Fenwick hardening acceptance review

Reviewed on 2026-09-07: `codex/fenwick-hardening`, HEAD
`929ae5473e6152a5647b47fe2032a9494371f439`, including the accompanying uncommitted
hardening changes. Comparison: local `main` at
`5304cb140e5d609158656fd0d5fac716511b37f3` and the branch's merge base.
This is an acceptance record, not a rolling optimization plan.

## Acceptance criteria

| Requirement | Evidence |
| --- | --- |
| Correct offsets, sizes, and inverse lookup through measurements, splice, move, invalidation, empty data, and zero sizes | Prefix/row store tests and randomized mutation contracts against a naive model, including fractional sizes and repeated zero/positive transitions |
| Sparse cost for distant logical ranges | Million-row contracts, source key-read counts, mutation/read benchmarks, and native million-row fixture |
| Preserve measurement ownership across recycling and same-key invalidation | Fabric synchronous/late callback tests, collected-result invalidation tests, legacy delayed native measurement regression, and web observer tests |
| Preserve native layout-effect timing | Synchronous Fabric collection and recalculation tests; invalidation during a measurement pass; direct native recalculation path; no new frame, timer, or microtask boundary |
| Correct source revisions, reset/replacement, identity, placeholders, and subscriptions | Observer, mutation coordinator, indexed-data, rendered-item, lifecycle, and public type tests |
| Preserve anchors, end maintenance, initial scroll, arrays, and grids | Bootstrap, MVCP, scroll, allocation, row-span, and viewability regressions; native fixtures below |
| Reject callbacks from obsolete sources | Delayed viewability replacement regressions for both arrays and data sources |

## Consolidated blockers and fixes

All four findings were reproduced before applying their fixes.

1. **Zero-size samples collapsed estimates for unknown items.** Four measured
   zeros in a 1,000-row list changed its estimate from 100 to zero and reduced
   total size from 99,600 to zero. Rebuilding from two cached zero measurements
   had the same failure. Periodic and seed estimation now use positive measured
   samples. Actual zero-size geometry and the general measured-average API are
   preserved. Prefix and row stores maintain positive sample counts alongside
   existing aggregates, avoiding a scan or duplicate per-item cache.
2. **An all-zero fixed-size sample made initial allocation unbounded.** Dividing
   viewport size by zero produced an infinite container count. Initial allocation
   now falls back to a positive estimate when the sample has no positive size.
3. **Legacy delayed native measurements survived same-key invalidation.** A
   delayed `measure` callback could restore old geometry and overwrite the
   container's local last size. Measurement callbacks now retain their assignment
   generation; both local application and the shared batch application validate
   it. Missing initial generations consistently mean generation zero.
4. **Delayed viewability mixed data from different sources.** A timeout could
   read an old source's item with the replacement source's key. Timed callbacks
   now require the same indexed-data adapter, and replacement data waits for its
   own scheduled callback.

The final pass also retains the preceding hardening: invalidation before
synchronous publication, estimate sampling based on new measurements rather
than retained cache count, and linear collection of materialized update-only
batches. Native geometry updates still flush synchronously at the existing batch
boundary. The pre-existing idle estimate policy and web shrink confirmation are
unchanged.

## Automated validation

- `bun test`: **1,812 passed, 0 failed**, 40,794 assertions across 132 files.
  Fresh-process wrappers also exercise the legacy and web measurement cases.
- `bun run lint:fix`, followed by lint as part of the build: passed.
- `bun run tsc:src`, `bun run tsc:types`, `bun run tsc:example`: passed.
- `bun run build`: passed, including prebuild and postbuild.
- `git diff --check`: passed.

The full tests, source/public types, and build ran in an independent dependency
snapshot because this worktree's root dependencies link to the main checkout.
Every changed source/test/benchmark file was verified byte-identical to the
validated snapshot. Example type checking and Metro used this worktree directly.

## Performance acceptance

Node 24.19.0 on Apple Silicon; two warmups followed by ten samples, reporting
medians. These measure algorithm work, not native frame time.

| Current workload | Median |
| --- | ---: |
| 2,000 update operations, 10,000 materialized identities | 0.241 ms |
| Invalidate one grid item, 100,000 known sizes | 0.000291 ms |
| 100,000 prefix point reads | 22.934 ms |
| 100,000 prefix range reads in windows of 100 | 1.123 ms |

Key reads equal the number of affected materialized updates, independent of cache
size. Read checksums match the prior benchmarks. The earlier 2,000-operation
baseline was 48.277 ms; methodology and earlier comparisons are in
[mutation-scaling.md](../benchmarks/mutation-scaling.md).

The positive-sample aggregate adds one numeric field per packed block/tree node
and one scalar in the row store. A controlled comparison against HEAD measured
100,000 first measurements at 34.23 ms before / 36.89 ms after, and remeasurements
at 27.06 ms before / 26.67 ms after. Reusing the existing mutation path removes a
redundant lookup and path allocation. The small first-measurement cost is an
accepted correctness tradeoff; remeasurement differences are within timing noise.
The sparse Bun diagnostic retained roughly 1.64 MB and 786 tree nodes after
100,000 measurements and structural edits, rather than allocating by logical
length.

## Native acceptance

iPhone 17 simulator, iOS 26.5, React Native 0.81.5 / Expo 54, Fabric development
client. Metro's verified project root and module aliases point into this exact
worktree. Screenshots and runtime geometry were inspected together.

- **Data Source Chat:** a fresh mount showed messages 88–100 at the end. Prepending
  100 retained the same visible messages and alignment. Appending displayed the
  new last item and retained a bottom gap within 0.001 point of zero.
- **Data Source Grid:** inserted a product, enabled variable spans, inserted a
  full-width promotion row, then moved four items. The promotion occupied its own
  row; surrounding products reflowed correctly without overlap.
- **Million-line Data Source:** jumped to index 500,000 with 27 containers and 54
  measurements. A preserve edit updated text; invalidation resized the target
  from 44 to 80 points while its relative top remained zero. Inserting a row
  shifted its identity to index 500,001. Jumping to the new final index displayed
  the final row with zero bottom gap. Only 79 known sizes, three packed blocks,
  and five tree nodes were retained across 1,000,001 logical items.

- **Array-backed rapid append:** started at the original tail, appended four
  three-row batches 60 ms apart, and finished on `rapid-11` with a bottom gap of
  -0.125 point (below one physical pixel on this simulator).

No runtime errors were logged. Rapid appending emitted one existing on-demand
container-allocation warning; the list allocated the required slot and retained
correct end positioning. Pool-size tuning is optional, not a correctness blocker.

## Review boundary

No new asynchronous batching, public API expansion, or speculative architecture
change was introduced by this acceptance pass. Structural/incomplete-cache
mutation batches retain their documented reconciliation fallback; variable-span
grid structure can still require rebuilding topology. Those are deliberate
tradeoffs, not unresolved correctness findings.

Native checks cover iOS Fabric. Android device behavior, a physical legacy-native
build, production frame-rate profiling, and an exhaustive visual browser matrix
were not run. Legacy and web paths have automated coverage; native fixture
results do not establish production frame-time improvements.

## Final verdict

**Ready as-is. No known material findings remain within these acceptance criteria.**

The architecture remains appropriate: sparse sequence geometry is the shared
source of truth, while mutation identity and measurement lifetime are enforced at
their owning boundaries. The four fixes are contained, preserve existing public
behavior, and have regressions at those boundaries. Performance tradeoffs and
platform validation limits are recorded above rather than treated as open-ended
requirements.

**100% happy: Yes**, as a recommendation to ship this reviewed state under the
stated acceptance criteria, not a guarantee that no undiscovered defect exists.
Reopen review for a concrete regression, changed requirement, or changed diff;
optional optimizations do not prevent this review from passing.
