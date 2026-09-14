# Mutation and read scaling

The benchmark in `mutation-scaling.ts` measures a million logical items with
1,000, 10,000, and 100,000 materialized identities or measurements. Each sample
uses two warmups and the median of ten subsequent runs. Setup is outside the
measured region. Coordinator samples call the production coordinator with no
mounted containers; they isolate retained-cache overhead. They do not measure
rendering, native layout, or frame time.

Run with `bun run bench:mutation-scaling`. For V8:

```sh
bun build benchmarks/mutation-scaling.ts --target=node --outfile=/tmp/mutation-scaling.mjs
node /tmp/mutation-scaling.mjs
```

Measured with Node 24.19.0 on Apple Silicon, after rebasing onto main and before
versus after the targeted optimizations:

| Workload | Before (ms) | After (ms) |
| --- | ---: | ---: |
| One materialized update, 100k cached identities | 21.205 | 0.0013 |
| Ten materialized updates, 100k cached identities | 52.263 | 0.0071 |
| Invalidate one grid item, 100k known sizes | 8.895 | 0.0003 |
| 100k prefix point reads | 33.264 | 22.260 |
| 100k prefix range reads, in windows of 100 | 9.628 | 1.107 |

Sub-millisecond timings are sensitive to timer noise and JIT warmup. The stronger
scaling evidence is that the single-item coordinator sample reads one source key
at every cache size, versus 1k/10k/100k keys before. Range-read checksums match.

The update fast path requires an update-only batch whose affected indexes are
already materialized in both identity caches. Structural mutations and incomplete
caches retain full sparse reconciliation, including validation. Large update
ranges also use that fallback to avoid scanning a huge logical range. Grid
invalidation visits the smaller of the requested range and the known-size cache,
then recomputes only affected rows. Prefix point reads omit mutation paths, and
range reads walk tree pieces instead of searching again for every item.


## Large update-only batches

A follow-up comparison against `929ae547` uses 10,000 cached identities and
separate single-item preserve operations in one atomic batch. It uses the same
Node environment, two warmups, and the median of ten runs, without mounted
containers or concurrent validation workloads.

| Operations per batch | Before (ms) | After (ms) |
| --- | ---: | ---: |
| 100 | 0.224 | 0.041 |
| 500 | 3.078 | 0.120 |
| 1,000 | 12.705 | 0.125 |
| 2,000 | 48.277 | 0.255 |

The update-only path now accumulates each affected entry's rendering and
invalidation flags during collection. It does not rebuild the full affected map
for every operation. Overlapping preserve operations cannot erase an earlier
invalidation, and each affected mounted item is published once per batch.
All mutation effects remain synchronous; no frame, microtask, or timer was added
to defer reconciliation. The benchmark now includes these larger batch sizes.
