# v4 sparse layout migration

Array and children lists retain their existing prop types, ordinary `Omit` wrappers,
and index-keyed measurement retention. Source-mode wrappers opt into
`LegendListDataSourceProps` (or `AnimatedLegendListDataSourceProps` for Reanimated).

## Approximate distant layout

`getFixedItemSize` resolves individual prepared rows. It no longer triggers a full
array pass on ordinary layout. Initial sampling, visible and buffered ranges, and
pinned rows prepare fixed sizes; other rows share the list estimate.

In array mode, `initialScrollIndex` and `scrollToIndex` resolve fixed sizes through
the target so its prefix offset is exact when every preceding row supplies a fixed
size or has been measured. This includes SectionList index navigation. First use
requires `O(unresolved prefix)` size callback work; later resolutions skip measured
spans and retry only unresolved rows. Rows whose callback returns `undefined` still
need measurement and offset correction. Rows beyond the target remain lazy, apart
from the destination viewport prepared by programmatic scrolling.

Source mode keeps index navigation target-only and never walks the prefix. Unloaded
items are not passed to fixed-size or item-type callbacks. Distant source offsets
remain estimate-backed until preceding geometry is known.

Until rows are prepared, `getState().positionAtIndex()`, `contentLength`, restored
offsets, `initialScrollAtEnd`, `scrollToEnd`, and `snapToIndices` can be approximate.
Offsets and total size can change as more fixed or measured sizes become known.
A uniform fixed size with a matching `estimatedItemSize` avoids this mixed-size
estimation error. Choose a representative estimate when restoring distant offsets.

Unmeasured rows now use one list-wide estimate, initially `estimatedItemSize` and
later the measured mean, instead of a per-`getItemType` average. The store's mean
can include prepared fixed-size rows. `getState().getAverageItemSizes()` continues
to report per-type averages, but those averages do not drive row positions.

## Sparse state queries

`getState().indexByKey()` and `positionByKey()` can return `undefined` for a key that
has never been prepared. The `sizes` map contains known prepared sizes, and
`sizeAtIndex()` can return `undefined` for an unprepared fixed-size row. Main eagerly
resolved keys and fixed sizes across array data. Prefer index-based navigation;
`positionAtIndex()` is available for in-range indexes but follows the approximate
layout contract above. Key extraction and item-dependent layout/comparison callbacks
are also lazy, so they must not depend on being invoked for every logical row.

## Index keys

The `keyExtractor` development warning now explains that measured sizes stay with
their index: appends retain layout, while inserts, removals, and reorders can give
moved items stale sizes until remeasured. Use a stable unique `keyExtractor` for
editable arrays. Index-keyed measurement retention remains compatible with main.

## End following

Programmatic scroll requests cancel active and queued `maintainScrollAtEnd`
following, including requests waiting for layout. Drag-begin cancels native
following; upward user scrolling also cancels on web. This matches main and the
released v3.4–v3.6 behavior.

Native wheel, keyboard, or accessibility input without drag-begin can still fail to
escape following while content streams continuously. That is a pre-existing gap.
A heuristic based only on upward offsets could mistake late native acknowledgements
for input, so this migration keeps the released cancellation rules.

## Other behavior corrections

- Invalid `numColumns` values (anything other than a positive integer) become 1
  with a development warning.
- Non-finite or negative `estimatedItemSize` values use the default estimate of
  100. Invalid fixed sizes and scroll-axis measurements become 0, with fixed sizes
  clamped before adding the layout gap. Invalid inputs emit a development warning.
  Main allowed invalid values to degrade layout; v4 prevents invalid geometry and
  measurement callback payloads. Valid zero and fractional fixed sizes retain their
  meaning.
- `waitForInteraction` now gates visibility until interaction is recorded, and
  `minimumViewTime` counts uninterrupted eligibility per key and configuration.
  Code relying on the old ignored interaction gate or delayed-snapshot timing must
  adopt these corrected semantics: scroll or call `ref.current?.recordInteraction?.()`
  to open the gate. `recordInteraction` is new and optional on the ref, preserving
  compatibility with handwritten refs. Visibility hooks replay their current value
  after subscription instead of invoking callbacks during render; amount hooks use
  the list's default configuration rather than whichever callback pair ran last.
- Viewability deadlines use the current measured viewport and row geometry. Main
  delayed geometry checks using a captured viewport size, which could mark a
  partially visible row read after the viewport shrank. For example, Notifications
  Inbox keeps its fourth row unread when less than 60% is visible; it becomes read
  only after meeting that threshold for 120ms. In the regression's tested viewport,
  after Add 3 newer the settled count is 18 unread / 81 read rather than main's
  premature 17 unread / 82 read. The test models the geometry and timing; it does
  not establish simulator frame ordering.
  This follows the [FlatList viewability rules](https://reactnative.dev/docs/flatlist#viewabilityconfig):
  the item fraction, rather than the viewport fraction, determines eligibility.
- Renderers receive updated indices when retained keys move. A prepend can invoke
  `renderItem` for retained mounted rows whose index changed; keep renderers pure.

Source mode is additive: `getState().data` is `[]` because the source owns its items.
Array-mode `getState().data` still returns the supplied array. macOS receives native
scroll adjustment handling; this changes platform handling, not the public list
prop contract.
