## Plan
Add an `alwaysRender` prop to keep selected items mounted outside the virtualization window, with tests and demo coverage.

## API & Behavior
- Add `AlwaysRenderConfig` and `alwaysRender?: AlwaysRenderConfig` on `LegendList`.
- Config shape: `{ top?: number; bottom?: number; indices?: number[]; keys?: string[] }`.
- Always-rendered items are the union of `top`, `bottom`, `indices`, and `keys`, deduped and clamped to data bounds.
- Key-based entries require a stable key extractor; document expected behavior and fallback (ignore or warn) when no keys are provided.
- Stick to normal ordering (no sticky layout changes); only mount/unmount behavior changes.

## Core Implementation
- Extend the item-in-view calculation to include always-rendered indices.
- Reuse sticky-item retention logic where possible so pinned and sticky share the same non-recycling path.
- Ensure always-rendered items stay mounted even when scrolled fully away from view.

## Tests
- Add tests that assert always-rendered ranges extend start/end indices.
- Start at top and assert bottom always-rendered items are present; scroll to bottom and assert top items remain rendered.
- Include index + key-based cases with overlapping sources and out-of-range guards.

## Examples
- Add a React Native example showcasing top/bottom always-rendered items with a visible marker.
- Add a web playground example that makes always-rendered items obvious during scroll.

## Steps
- [x] Add tests that capture the always-render behavior (top/bottom + indices/keys).
- [x] Implement `alwaysRender` in core list logic and hook it up to public props.
- [x] Add examples in `example/` and `example-web/` to demonstrate the feature.
