# V8 and Hermes mutation profile

Captured on 2026-07-09 with Node 24.12.0 (V8) and the Hermes runtime bundled with React Native 0.81.5. Run `bun run bench:engines` to rebuild the same engine-neutral benchmark bundle and execute it in both runtimes.

The mutation samples isolate caller-side array copying from direct sparse layout mutation. Durations are diagnostic and vary between runs; the `work` field in the JSON output records the asymptotic unit count. Hermes reports whole milliseconds, so `0 ms` means the operation completed below its clock resolution.

| Operation | Logical length | V8 | Hermes | V8 temporary heap |
| --- | ---: | ---: | ---: | ---: |
| Array prepend 100 | 100,000 | 1.28 ms | 1 ms | 3.34 MB |
| Data-source layout prepend 100 | 100,000 | 0.147 ms | <1 ms | 15 KB |
| Array prepend 100 | 1,000,000 | 7.72 ms | 12 ms | 34.48 MB |
| Data-source layout prepend 100 | 1,000,000 | 0.036 ms | <1 ms | 4 KB |
| Array middle insert | 1,000,100 | 6.04 ms | 27 ms | 30.24 MB |
| Data-source layout middle insert | 1,000,100 | 0.034 ms | <1 ms | 6 KB |
| Array single-item update | 1,000,101 | 0.69 ms | 16 ms | 8.01 MB |
| Data-source layout invalidation | 1,000,101 | 0.032 ms | <1 ms | 7 KB |
| Regular-grid prepend | 1,000,000 | 0.50 ms | <1 ms | 38 KB |
| Regular-grid move | 1,000,004 | 0.26 ms | 1 ms | 31 KB |
| Variable-span tail repack | 100,000 | 1.14 ms | 1 ms | 19 KB |

The array costs grow with logical length because the owning model must copy the collection before Legend List sees it. Exact data-source mutations remain proportional to the mutation and sparse known state; the 100,000-row and 1,000,000-row results stay in the same sub-millisecond range.

## Materialization and GC

Materializing measurements is intentionally proportional to the number of rows that become known:

| Workload in a 1,000,000-row document | V8 | Hermes |
| --- | ---: | ---: |
| First 10,000 sequential measurements | 3.98 ms | 46 ms |
| Next 90,000 sequential measurements | 24.73 ms | 607 ms |
| Final 900,000 sequential measurements | 395.51 ms | 8,685 ms |
| 1,000 random jumps × 40 measured rows | 53.36 ms | 447 ms |

The full Hermes run performed 428 collections, spent 6 ms total in GC, had a maximum reported pause of 1 ms, and peaked at about 8.07 MB live after collection. It allocated about 1.39 GB cumulatively across all array-copy, sequential-materialization, random-jump, and grid scenarios. The retained packed layout stays small, but evaluating and materializing every one of one million rows is still substantial work on Hermes. Normal sparse jumps and exact edits avoid that full pass.

These engine profiles cover JavaScript source/layout work. The native fixtures `data-source-million-markdown`, `data-source-chat`, and `data-source-grid` provide the corresponding React rendering, recycling, measurement, MVCP, end-following, regular-grid, and variable-span surfaces for application-level profiling.
