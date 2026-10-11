# v4 sparse layout migration

Array and children lists retain their existing prop types, ordinary `Omit` wrappers,
and index-keyed measurement retention. Source-mode wrappers opt into
`LegendListDataSourceProps` (or `AnimatedLegendListDataSourceProps` for Reanimated).

## Approximate distant layout

`getFixedItemSize` resolves individual prepared rows. It no longer triggers a full
array pass that makes every mixed-size offset exact. Initial sampling, visible and
buffered ranges, pinned rows, and scroll targets prepare fixed sizes; other rows
share the list estimate. This keeps ordinary work proportional to prepared state.

Until those rows are prepared, `getState().positionAtIndex()`, `contentLength`,
distant scroll targets, restored offsets, and `snapToIndices` can be approximate.
A distant SectionList target has the same limitation. Offsets and total size can
change as more fixed or measured sizes become known. A uniform fixed size with a
matching `estimatedItemSize` avoids this mixed-size estimation error; varying fixed
sizes do not provide globally exact layout. Choose a representative estimate and
allow measurement corrections when restoring distant positions.

Unmeasured rows now use one list-wide estimate, initially `estimatedItemSize` and
later the measured mean, instead of a per-`getItemType` average. The store's mean
can include prepared fixed-size rows. `getState().getAverageItemSizes()` continues
to report per-type averages, but those averages do not drive row positions.
Restoring type-specific positions or exact distant fixed-size offsets would require
full-list work and is deliberately deferred.

## Sparse state queries

`getState().indexByKey()` and `positionByKey()` can return `undefined` for a key that
has never been prepared. The `sizes` map contains known prepared sizes, and
`sizeAtIndex()` can return `undefined` for an unprepared fixed-size row. Main eagerly
resolved keys and fixed sizes across array data. Prefer index-based navigation;
`positionAtIndex()` is available for in-range indexes but follows the approximate
layout contract above. Key extraction and item-dependent layout/comparison callbacks
are also lazy, so they must not depend on being invoked for every logical row.

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
- Non-finite or negative public item estimates, fixed layout sizes, and scroll-axis
  measurements become 0 with one development warning. Main allowed invalid values
  to degrade layout; v4 keeps the non-throwing public path while preventing invalid
  item geometry. Valid zero and fractional fixed sizes retain their meaning.
- `waitForInteraction` now gates visibility until interaction is recorded, and
  `minimumViewTime` counts uninterrupted eligibility per key and configuration.
  Code relying on the old ignored interaction gate or delayed-snapshot timing must
  adopt these corrected semantics. Visibility hooks replay their current value
  after subscription instead of invoking callbacks during render; amount hooks use
  the list's default configuration rather than whichever callback pair ran last.
- Renderers receive updated indices when retained keys move. A prepend can invoke
  `renderItem` for retained mounted rows whose index changed; keep renderers pure.

Source mode is additive: `getState().data` is `[]` because the source owns its items.
Array-mode `getState().data` still returns the supplied array. macOS receives native
scroll adjustment handling; this changes platform handling, not the public list
prop contract.
