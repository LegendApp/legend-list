## Plan

Move anchored end-space calculation into core as a dedicated primitive, then migrate native and web adapters to consume the shared result without reusing the generic `reportContentInset` override channel.

## Goals

- `anchoredEndSpace` is the canonical public API for this behavior.
- Core owns the anchored end-space calculation and internal state.
- `keyboard-chat` and web consume the same core primitive instead of duplicating list-state scans.
- Anchored end-space no longer depends on `contentInsetOverride`.

## API

- Add `anchoredEndSpace?: { anchorIndex: number; includeInEndInset?: boolean; onSizeChanged?: (size: number) => void }`.
- `includeInEndInset` defaults to `false`.
- `onSizeChanged` fires only when the computed size changes, including `0` when clearing.

## Steps

- [x] Add the core `anchoredEndSpace` primitive, dedicated internal state, and core tests for size calculation/clearing/merge behavior.
- [x] Migrate `keyboard-chat` to use `anchoredEndSpace` and add native adapter coverage without using `reportContentInset`.
- [x] Add web usage of `anchoredEndSpace` with real end spacer rendering and web adapter coverage.
