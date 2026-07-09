# Sparse sequence layout comparison

Captured on 2026-07-09 with Bun 1.3.14 on the same machine and process shape. Each implementation used a logical length of 1,000,000, materialized 100,000 sequential measured sizes, prepended one unknown row, and moved 10,000 rows. Heap statistics were captured after a forced collection and while retaining the store.

| Metric | Absolute-index treap | Packed implicit sequence | Change |
| --- | ---: | ---: | ---: |
| Materialize 100,000 sizes | 23.77 ms | 26.33 ms | 1.11x slower |
| Prepend one row | 33.24 ms | 0.077 ms | 432x faster |
| Move 10,000 rows | 49.34 ms | 0.101 ms | 488x faster |
| JS heap growth | 11.33 MB | 1.64 MB | 85.5% lower |
| JS object growth | 200,582 | 6,348 | 96.8% lower |
| 10,000 offset/inverse queries with 1,000 known rows | 2.62 ms | 2.03 ms | 22% faster |

The packed store trades a small one-time sequential materialization cost for dramatically cheaper structural edits and much lower retained object and GC pressure. Re-measurement updates stay in-place inside packed blocks, while distant unknown ranges remain single aggregate runs. The runnable benchmark also reports forced-collection time for tracking GC behavior across future revisions; the table uses retained object growth as the directly comparable GC-pressure signal from the original treap capture.

Run `bun run bench:sparse-layout` and `bun run bench:data-source` to refresh the current measurements. Timing is diagnostic rather than a test assertion; correctness and asymptotic behavior are enforced by the randomized layout contract.
