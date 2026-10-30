## Unreleased

- Performance: Render rows the first scroll reveals near the top ahead of time by spending unused top buffer below the viewport.
- Fix: `KeyboardAwareLegendList` leaves keyboard dismissal scrolling to the keyboard controller, avoiding an instant end-follow jump while the keyboard closes.
- Fix: `onEndReached` and `onStartReached` fire again inside their threshold when the data length changes, or a new array arrives with a content size different from the size at the last callback. Stationary layout-only changes and empty data do not re-arm them.
    - Before: after firing, an edge stayed latched until the reader scrolled 30% beyond its threshold or, for the end only, until data grew. A new qualifying gesture could also retry the same length. A short list could stop loading older pages at the start or stop paging after a removal.
    - Now: inside its threshold, an edge fires again when the data length changes, or when a new data array arrives and the content size differs from the size at the last callback. A same-length empty page does not trigger another callback if the content size returns to that saved size, including when a loading footer appears and is then removed. A new user gesture toward that edge can retry unchanged data. If the current data array already received a callback for changed content, that delivery counts toward the next gesture; a later gesture can retry the same array. A new array with the same length and content size, such as one derived on every render, does not re-arm the edge, so callbacks that only set state do not loop. Synchronous data updates inside a callback preserve the latest delivered data. Without a new gesture, the existing shared 30% hysteresis still gates re-entry. End-following chats can also get a new end callback after data changes and following settles. While the scroll offset stays unchanged, row re-measures, image loads, header or footer toggles and inset changes do not re-fire an edge that already fired, even if they cross the 30% hysteresis band; a re-measure that first brings an edge inside its threshold fires it once. Clearing data to `[]` fires neither edge, and refilling starts fresh.
    - When: lists that stay inside a threshold, such as short lists, chats loading older pages with `maintainVisibleContentPosition`, and loading footers or headers.
    - Why: qualifying data and content size changes re-arm short lists, while stationary layout-only changes cannot loop loading requests. In particular, a loading footer that crosses the hysteresis band and is removed without data progress no longer repeatedly requests empty pages. Actual scroll-offset changes retain the existing distance-based re-entry behavior. Empty data has no first or last item to page from.
    - Known limitation: on iOS Legacy, a footer temporarily crossing the threshold can still suppress a subsequent append callback. This also occurs on 3.7.0.
- Fix: Vertical iOS lists with `contentInset.top` treat `-contentInset.top` as the start.
    - Before: the start was native offset `0`, so initial placement, index and end targets, `alignItemsAtEnd` padding, `isAtStart`, `onStartReachedThreshold` and `onStartReached` distances were off by the inset. A short list's `scrollToEnd` landed below the start, and an idle list stayed where it was when the inset changed.
    - Now: without an initial target, the list rests at `-contentInset.top`. Index and end targets, start thresholds and `onStartReached` distances are measured from that resting start, and a list resting at its start follows a changed top inset. `scrollToOffset` and `initialScrollOffset` stay raw native offsets like React Native's `ScrollView`: explicit `0` requests native zero. A `contentContainerStyle.paddingTop` change compensates only for overscroll past the resting start.
    - When: vertical iOS lists with a nonzero `contentInset.top`, such as lists under a translucent header.
    - Why: UIKit rests a scroll view with a top inset at `-contentInset.top`.
- Fix: Scrolling, end thresholds and `maintainVisibleContentPosition` share one physical content size, including `contentContainerStyle` minimum sizes.
    - Before: `scrollToOffset` included `minHeight`/`minWidth`, but `scrollToEnd`, initial placement, end thresholds and MVCP clamps used the row content only. On native, list-owned `anchoredEndSpace` counted only the larger of itself and the bottom inset.
    - Now: these paths use the content plus in-container end space, raised to the minimum size. Native vertical and horizontal LTR insets extend that minimum, and their list-owned anchored end space adds to the content inset; horizontal RTL retains its prior overlapping inset convention. `isAtEnd`, `isNearEnd` and `onEndReached` measure from the end of the minimum size. Item targets still align to rows, while explicit raw offset requests preserve native zero for short inset content. Native horizontal RTL offset and end targets retain their prior inset coordinate basis while accounting for the minimum width. Snap offsets and native RTL row virtualization retain their prior item extent. On vertical and horizontal LTR lists, list-owned end space keeps its anchor offset when a native end inset changes, unless the container minimum itself prevents that alignment.
    - When: lists with a `contentContainerStyle` `minHeight` or `minWidth`, or with `anchoredEndSpace` and a native bottom inset.
    - Why: the native scroll range includes that space, so other paths clamped short of the real end or bounced.
- Fix: Native end following stays at the end while rows measure and the viewport resizes.
    - Before: an instant `scrollToEnd` or end follow kept the end offset it started with, so settling measurements or a content-size change while the native scroll view clamped could leave it short. Android could count its shrink clamp twice, and changing `maintainScrollAtEndThreshold` waited for the next scroll to apply.
    - Now: explicit instant end requests wait for native progress before completing, active end requests retarget as measurements settle, clamped native end requests are reissued when the native content size changes unless a replacement request is waiting, a replacement that needs no scroll releases the old instant target, Android's shrink clamp is counted once, and threshold prop changes refresh end following right away.
    - When: iOS and Android lists using `maintainScrollAtEnd` or `scrollToEnd({ animated: false })`, especially across keyboard, rotation and other viewport changes.
    - Why: the end moves while rows measure and the viewport changes, so a request fixed to its first target lands short.
- Fix: On web, a wheel that interrupts an animated list scroll applies its delta exactly once.
    - Before: interrupting an animated `scrollTo`, `scrollToEnd` or end follow stopped at the pre-wheel offset. Chromium lost the wheel, which near the end could let following re-arm, while WebKit and Firefox applied it natively.
    - Now: the stop write includes a cancelable wheel's delta and cancels its native scroll. Non-cancelable wheels keep their native movement without adding it again. Deferred scroll adjustments commit from that same wheel destination, including while a replacement request waits for layout. The wheel listener is non-passive only while a list scroll is active, so idle wheel scrolling stays passive.
    - When: web lists receiving wheel or trackpad input during an animated list scroll.
    - Why: browsers disagree on whether such a wheel still scrolls, and a non-passive wheel listener on every list delays scrolling.
- Fix: Lists keep the visible anchor current while rows change size inside the rendered window.
    - Before: scrolling inside the cached render window refreshed the visible range only for viewability callbacks or `onFirstVisibleItemChanged`, so `maintainVisibleContentPosition` could anchor to a row that had scrolled away while streamed rows grew.
    - Now: the visible range is refreshed on every scroll inside the cached window.
    - When: lists with `maintainVisibleContentPosition` whose rows grow while visible, such as streamed chat messages.
    - Why: the anchor must be a row that is currently visible.
- Fix: Container measurements are applied only to the item the container currently holds.
    - Before: after data changes, a container's measurement could arrive with a stale item index and overwrite another item's size, misplacing rows.
    - Now: native, web and batched measurements are checked against the current key index and retried after the parent's layout effects refresh it. Data changes before the first viewport also invalidate cached positions so measurement retries settle on current keys.
    - When: inserts, removals, reorders or recycling while containers are measuring.
    - Why: a size must belong to the row that was measured.

## 3.7.0

- Fix: List ref methods `scrollToIndex`, `scrollToOffset`, `scrollToItem`, `scrollToKey`, `scrollToEnd`, `scrollIndexIntoView`, and `scrollItemIntoView` resolve their promises once the scroll lands, or when it is interrupted by user input, canceled or replaced, or cannot reach its target (including removed targets, dataset replacement, and unmounting), instead of resolving early or never.

    Suspense/Activity hide counts as unmounting for scroll requests. Requests made through a captured ref while hidden resolve without scrolling and are not replayed on reveal.

    `scrollToIndex` and `scrollToOffset` clamp out-of-range targets and resolve once landed. Index-based navigation and `scrollToEnd` on empty data resolve without scrolling, including when a header or footer is present.

- Types: new required members on `LegendListRef` / state since 3.6.0. These stay required, and code that implements or mocks these types must add them:

    - `LegendListRef` (native and web): `cancelScroll`, `scrollToKey`, `anchorVisibleContent`.
    - `LegendListState`: `distanceFromEnd`, `isFollowingEnd`. `dataKey` is added as optional.
    - `SectionListRef`: `cancelScroll`, `scrollToKey`, `anchorVisibleContent` (inherited from `LegendListRef`). Key-based methods use the flattened keys `${sectionKey}:item:${itemKey}`, `${sectionKey}:header`, `${sectionKey}:footer`, `${sectionKey}:separator:${itemIndex}`, and `${sectionKey}:section-separator`, where `sectionKey` is the section's key or `section-${sectionIndex}`.
    - `LegendListMetrics`, the `onMetricsChange` payload: unchanged from 3.6.0, still `headerSize` and `footerSize`. Scroll position and end-distance fields added during the cycle were removed before release.

    `getState().listen` accepts the new `isFollowingEnd` key. `distanceFromEnd` is not a listen key; read `getState().distanceFromEnd`, which is computed on demand. 3.6.0-shaped `listen` implementations remain assignable.

- Feat: Add ref methods `cancelScroll` to stop queued and active scrolling, `scrollToKey` to navigate by stable item key through prepends, and `anchorVisibleContent` to capture an item's key and viewport offset and hold it through layout changes (the first visible item by default). Pass `{ key }` to choose an item, or use `anchorVisibleContent({ hold: false })` for a snapshot without side effects. Returns `undefined` before initial placement, during dataset replacement, or if no item is found; at the end while following, it returns the anchor without interrupting end following.
- Feat: Add `viewportMargin: { start, end }` to `scrollIndexIntoView` to keep space clear at the start and end of the viewport along the scroll axis.
- Feat: Add `itemOffset` and `itemLength` to `scrollIndexIntoView` and `scrollItemIntoView` to reveal a region inside an item within `viewportMargin` on vertical and horizontal lists.
- Feat: Expose `distanceFromEnd`, `isFollowingEnd`, and `dataKey` through `getState()`, and accept `isFollowingEnd` in `getState().listen`.
- Feat: Add boolean `maintainScrollAtEnd.on.dataAppend` to follow only additions that preserve existing item keys in order; `on.dataChange` remains a boolean option for all data changes.
- Feat: `onUserScroll` fires once per accepted real user gesture (native drag with its momentum, web touch/wheel gesture, scroll key press, scrollbar input, or iOS status-bar tap), never for library or list-ref scrolls, and remains `@experimental` with heuristic wheel grouping and gaps in native pointer/wheel-only and web overlay scrollbar detection.
- Fix: With a native screen reader enabled, unowned accessibility scrolling toward the start releases end following and reports `onUserScroll` once per burst; assistive input during library animations or just after `cancelScroll()` can be missed, and scrolls bypassing the list (such as native-ref commands or Reanimated `scrollTo` worklets) cannot be distinguished from accessibility input, so call `cancelScroll()` on the JS thread before that navigation.
- Fix: Leftover trackpad momentum no longer cancels scroll commands; a new wheel gesture can interrupt them, while upward wheel motion releases automatic end following as in 3.6.0 and downward motion never does.
- Fix: iOS status-bar taps release end following and settle an interrupted list scroll.
- Fix: Native scrolls outside list-owned commands release end following when they move beyond its threshold, and appends while reading earlier rows leave no pending end measurements.
- Fix: Pausing `maintainScrollAtEnd` retains end intent for resuming; `isFollowingEnd` continues to report that intent while paused.
- Fix: Item-layout end following responds to every nonzero size change when its trigger is enabled.
- Fix: End thresholds (`isAtEnd`, `onEndReached`, and `maintainScrollAtEnd`) count trailing content and keyboard insets once. With a trailing inset, they now activate closer to the physical end instead of firing early by the inset amount.
- Fix: Row measurements and header/footer size changes recheck `onStartReached` and `onEndReached` thresholds, so pagination callbacks can fire without a scroll when layout brings an edge within its threshold.
- Fix: Animated end following stays aligned through short-list growth, footer and viewport changes, late row measurements, and native drag-to-momentum handoffs. #563 #568
- Fix: Automatic native end following waits for a drag and its momentum to settle, then catches up near the end using the configured threshold.
- Fix: Keyed scroll targets survive prepends and same-key item updates, cached dataset switches restart initial placement, and fixed-size updates and cache clearing preserve the reader's anchor.
- Fix: `scrollToOffset` can reach `contentContainerStyle` minimum sizes, horizontal RTL web lists use the scroll owner's direction for offsets, and horizontal RTL scroll-offset conversion keeps numeric `minWidth` in the physical content extent.
- Fix: When `getFixedItemSize` is set, changing `extraData` invalidates all fixed sizes and repositions the data.
- Fix: Inline `onMetricsChange` callbacks no longer cause repeated metrics emissions.
- Fix: End following rearms when a scroll or gesture settles within `maintainScrollAtEndThreshold`, so new content resumes following after `scrollToIndex`/`scrollToOffset` or a small nudge that stays near the end.
- Fix: When `getFixedItemSize` starts returning sizes for rows that were already measured, their stale measurements are dropped and the fixed sizes are applied, including rows reordered in the same render.
- Fix: Web lists follow the end in one painted frame when every row grows after a mount or `dataKey` switch, instead of clamping against the stale content extent and catching up a frame late.
- Fix: On Fabric, the native content extent commits in the same render pass as row positions, so shrinking content cannot briefly leave rows mispositioned.
- Fix: `scrollMessageToEnd({ closeKeyboard: true })` starts scrolling right away and eases to the closed end in one motion while the keyboard closes, dismissing it once, including back-to-back and mixed animated and non-animated sends.
- Fix: `AnimatedLegendList` `itemLayoutAnimation` no longer animates rows while scrolling, during list scroll commands, or after layout adjustments, and skips the transition when a container switches items even without `recycleItems`.
- Fix: Keyboard occlusion is excluded from viewability calculations, horizontal viewability uses the correct start padding including RTL, native content insets are counted only where applied, and `KeyboardAwareLegendList` keeps the static `contentInset` prop out of Android keyboard inset reports so it is not counted twice.
- Fix: `scrollMessageToEnd({ closeKeyboard: true })` freezes keyboard tracking before the keyboard starts closing, so the list scrolls to the end in one motion instead of first moving back with the closing keyboard. A rejected scroll or a keyboard close that never settles no longer leaves `freeze` set. #557
- Fix: Animated scrolls that start past the end of the content ease back into range instead of snapping.
- Perf: With `recycleItems` enabled, reuse warm offscreen rows before empty containers, and skip key extraction for unchanged append prefixes.

## 3.6.0

- Feat: Add `viewPositionFallback` to align oversized items to the start or end of the viewport during initial or programmatic scrolling, while keeping `viewPosition` alignment for items that fit.

## 3.5.0

- Feat: Add `scrollElement` so web lists can share an ancestor element's scrollbar
- Fix: Stopping scrolling keeps rows prepared in the last scroll direction instead of shifting the render buffer backward.
- Perf: Single-column lists do less layout work during initial rendering and scrolling when item sizes and data are unchanged.

## 3.4.0

- Feat: Add `onReady`, called after each initial placement and scroll cycle completes, including cycles restarted by a `dataKey` change.
- Fix: End-following and animated programmatic scrolling now stay aligned through footer, viewport, and native layout changes, while user dragging cancels queued follow requests.
- Fix: `onStartReached` and `onEndReached` callbacks now fire reliably after layout and dataset resets, including short lists and gestures that cross a threshold over multiple events.
- Fix: Numeric `initialScrollIndex` values that target the last row now include the footer when opening at the end.
- Perf: Fast scrolling now prepares rows in the direction you are moving, including upward and end-aligned scrolling, so the next content is ready sooner.

## 3.3.11

- Fix: `scrollToEnd` and `maintainScrollAtEnd` keep reaching the end as content changes, while scrolling away or requesting another position cancels automatic following.
- Fix: Switching datasets cancels old scroll requests so they cannot override the new dataset's initial position.
- Fix: `anchoredEndSpace` shrinks excess blank space as rows are measured instead of waiting for every remaining row.
- Fix: Resizing the chat composer preserves the combined keyboard and composer spacing.
- Fix: Web scroll adjustments no longer leave extra padding at the end of the list.
- Fix: Web row reordering happens sooner when idle and preserves focus, animations, and embedded content state in browsers that support state-preserving moves.

## 3.3.10

- Fix: Changing `dataKey` no longer loses the new dataset's initial scroll position when React retries a render.

## 3.3.9

- Fix: Rows after an item that changes size stay in the correct positions while scrolling

## 3.3.8

- Feat: Add `experimental_hideItemsUntilMeasured` to make items never display at provisional layouts and wait for correct sizing, at the cost of an extra render per recycled row. This fixes cases where slow item renders could display with gaps/overlaps when scrolling up quickly on slow phones.

## 3.3.7

- Fix: Recycled rows no longer briefly show content from the wrong item when data is prepended.

## 3.3.6

- Fix: Animated `maintainScrollAtEnd` follows rapid and first-load content growth, including short `alignItemsAtEnd` lists, and stops when the user scrolls away.
- Fix: Item size changes no longer interrupt momentum scrolling when `maintainVisibleContentPosition` adjusts the scroll position.
- Fix: A numeric `initialScrollIndex` targeting the last item stays at the end when the viewport is measured or resized, while object targets and explicit offsets keep their requested alignment.

## 3.3.5

- Fix: Changing `dataKey` no longer leaves the new dataset invisible. #519
- Fix: `maintainScrollAtEnd` stays pinned as newly inserted rows are measured, and scroll corrections preserve `anchoredEndSpace` padding. #520
- Fix: Programmatic scrolls no longer throw in browsers, get lost when they replace unfinished initial scrolling, or stop working after a previous request is canceled. #518

## 3.3.4

- Feat: `getState().indexByKey(key)` looks up an item’s current index by key.
- Feat: `anchoredEndSpace` now works with standard React Native `LegendList`, including horizontal and RTL lists, and stays accurate after content measurements change. It supports single-column lists only.
- Fix: `maintainScrollAtEnd` continues following content growth unless the user scrolls away.
- Fix: Changing `dataKey` no longer briefly displays stale rows from the previous dataset.
- Fix: Initial scrolling and `scrollToIndex` correctly account for padding, direction, and final-item gaps.
- Fix: Web content-container sizing remains correct when callers provide padding or `content-box` styles.
- Fix: `useRecyclingEffect` and `useRecyclingState` no longer crash outside a `LegendList`. #498
- Fix: Programmatic scrolls settle reliably when superseded, already aligned on iOS, or interrupted by unmounting. #508
-
## 3.3.3

- Fix: Row measurements are applied together in a batch, so item positions don't sometimes move after rendering.
- Fix: `onStartReached` and `onEndReached` no longer bounce between opposite edges during the same scroll gesture after data changes, MVCP adjustments, or residual scroll events.
- Fix: Prepending items with `maintainVisibleContentPosition` was sometimes flashing the wrong items for one frame
- Fix: SectionList sticky headers follow their current positions after section data changes. #445
- Fix: `LegendList` can now be wrapped with `Animated.createAnimatedComponent`.
- Fix: Horizontal web lists keep their calculated content width, so item containers do not shrink when the content is wider than the viewport.
- Perf: Lists reuse inactive containers across item types before creating more, preventing the container pool from growing for every previously seen item type.
- Perf: Reanimated lists skip scroll-offset tracking when neither shared scroll values nor sticky headers need it.

## 3.3.2

- Perf: Recycled rows update their current item without changing the container context, so recycling hooks avoid extra rerenders during scroll.
- Perf: Internal signal hooks recreate subscriptions less often

## 3.3.1

- Perf: Animated `scrollToIndex` and `scrollToOffset` calls now mount the destination rows before native scrolling starts, so long programmatic jumps are less likely to show blank space at the target.
- Perf: Fast scrolling shifts more of the render buffer in the direction of travel and settles back after scrolling stops, so rows ahead of the user are ready sooner without keeping the buffer displaced afterward.
- Perf: Scroll velocity favors recent movement and ignores stale samples, preventing old scroll events from keeping the render buffer pointed in the wrong direction after scrolling slows or stops.
- Perf: On Fabric, row measurements wait for all expected layout-effect measurements before recalculating positions, reducing the number of computations while scrolling quickly.

## 3.3.0

- Feat: Add `dataKey` so apps can tell the list when the current array represents a different dataset, such as switching conversations or feeds without remounting `LegendList`.
- Feat: `experimental_adaptiveRender.onChange` now receives a reason (`initial`, `ready`, or `scroll`) so item components can tell why the render mode changed.
- Fix: Large user scroll jumps render the visible rows first and fill the normal draw distance on the next frame, making long jumps less likely to land on a blank range.
- Fix: `maintainScrollAtEnd` reruns a pending keep-at-end request after the current one settles, so a footer resize and a new message arriving together keep chat-style lists pinned to the end.
- Fix: Replacing data after clearing the list, or changing `dataKey` for a non-empty replacement, resets layout readiness and uses the latest initial scroll target for the new dataset.

## 3.2.0

- Feat: Add `onFirstVisibleItemChanged` so apps can track the item at the top of the viewport without setting up full viewability callbacks.
- Feat: Add `experimental_adaptiveRender.initialMode` for choosing whether adaptive rendering starts in `normal` or `light` mode before the list is ready.
- Perf: On Fabric, replacement container measurements are batched into the same layout pass, so scroll anchoring and item positioning recalculate once instead of once per pending row.

## 3.1.2

- Fix: On Android, end-aligned lists could double apply scroll clamping during MVCP and be slightly underscrolled

## 3.1.1

- Fix: `maintainScrollAtEnd` now stays pinned when a `ListFooterComponent` appears, disappears, or changes size, so chat typing indicators and other dynamic footers do not leave the list slightly above the end. If you use an explicit `maintainScrollAtEnd.on` config, add `footerLayout` to opt into footer size changes.

## 3.1.0

- Feat: Add `experimental_adaptiveRender` prop, with `useAdaptiveRender` and `useAdaptiveRenderChange` hooks, so item components can render a lighter version while the list is moving quickly and return to normal after scrolling slows.
- Feat: Add `setItemSize` to the list ref for updating a known item's measured size directly when its content changes outside normal layout measurement.
- Fix: Web maintainVisibleContentPosition keeps the intended anchor when headers change, browser scroll anchoring runs, or an animated `scrollToEnd` is already in progress. #468 #463
- Fix: `initialScrollIndex` and `initialScrollAtEnd` use the latest initial scroll props when data starts empty and loads later, so lists do not scroll to an old startup target.
- Fix: Changing `gap` now refreshes cached item measurements, and fixed-size rows include the gap in their positions.
- Fix: SectionList sticky headers update after the section data changes. #445
- Fix: Horizontal lists with end alignment now place items at the end instead of ignoring the alignment. #472
- Fix: Lists clear scheduled timers on unmount, preventing delayed adaptive-render or scroll work from running after the list is gone.
- Perf: The first render starts with a smaller draw distance and expands shortly after, reducing offscreen work before the initial content appears.
- Perf: `alignItemsAtEnd` spacer updates cause fewer ScrollView rerenders.
- Types: Export `AdaptiveRender` and `AdaptiveRenderConfig` from the React Native and web type entrypoints.

## 3.0.6

- Fix: KeyboardAwareLegendList now accounts for bottom insets when alignItemsAtEnd is used, so short chat-style lists stay pinned above the keyboard or safe area instead of being pushed too low or leaving extra scroll space.

## 3.0.5

- Fix: clearCaches now rechecks the rows that are already on screen, so resetting the size cache does not leave items stuck in old positions.
- Perf: Scrolling through content that is already rendered now updates viewability with less work.
- Perf: Trimmed repeated work during scrolls, especially around recycled containers, sticky headers, size checks, and viewability.
- Perf: Large and fast scrolls now reuse more of the same scroll state instead of recalculating it in multiple places.

## 3.0.4

- Fix: scrollToEnd now waits for newly committed data before targeting the final item, improving chat-style append-and-scroll flows.
- Fix: Anchored end space waits for measured or fixed tail sizes before reporting readiness, avoiding stale end-space values during append flows.
- Feat: Add anchoredEndSpace.onReady to notify when the anchored tail has authoritative sizing.

## 3.0.3

- Fix: MVCP was getting batched to improve big jumps, but was making scroll worse
- Fix: On native, ignore one-physical-pixel layout measurement noise, preventing unnecessary item size updates from Fabric and native onLayout rounding differences.
- Fix: Average item sizes update correctly when getFixedItemSize returns undefined for only some item types.

## 3.0.2

- Fix: Using viewability was causing scrolling to end to sometimes not update items in view if the JS thread was slammed

## 3.0.1

- Feat: SectionList now supports getFixedItemSize for items, headers, footers, and separators.
- Fix: Non-animated scrollTo calls now precompute the target range before scrolling, preventing temporary blank content around the destination.
- Fix: scrollToIndex was landing at the wrong location on iOS in some scenarios

## 3.0.0

- Feat: Web support
- Breaking: Some of the maintainVisibleContentPosition behavior for preventing jumping while scrolling is now core behavior, and the behavior for maintaining scroll position when adding data is controlled by the prop, which is now disabled by default.
- See https://legendapp.com/open-source/list/v3/migration/

## 2.0.18
- Improvement: KeyboardAvoidingLegendList now supports KeyboardGestureArea with improved interactive behavior

## 2.0.17
- Feat: Add stickyHeaderOffset property to control sticky header positioning
- Feat: Add sticky header backdrop component support
- Fix: Improve KeyboardAvoidingLegendList quality by using animated contentOffset y instead of reanimated scrollTo
- Fix: Initial scroll could sometimes be out of range beyond the ScrollView if some items are much larger than the estimated size
- Fix: Item layout updates now work correctly when container is the exact same size as previous item on old arch

## 2.0.16
- Feat: Add KeyboardAvoidingLegendList component for better keyboard handling integration
- Fix: Stale containers are not being removed and overlap with new data when using getItemType #335
- Fix: Suppress keyExtractor warning when using lazy list mode #330

## 2.0.15
- Fix: Container allocation for sticky headers could duplicate containers, causing rendering issues
- Fix: Sticky positioned components scrolling out of viewport after scrolling distance exceeded 5000

## 2.0.14
- Feat: Add dataVersion prop to trigger re-render when mutating the data array in place

## 2.0.13
- Feat: Allow returning undefined in getFixedItemSize to fall back to estimated size
- Fix: scrollToIndex viewOffset was being subtracted twice, causing incorrect scroll positioning
- Fix: Initial container allocation was not applying maintainVisibleContentPosition calculations
- Fix: updateItemSize was providing full data array to getEstimatedItemSize and getFixedItemSize instead of individual item

## 2.0.12
- Fix: Scroll velocity calculation was sometimes incorrect when item sizes were very different from estimate
- Fix: onScroll while scrolling was updating positions without maintainVisibleContentPosition calculations, which was breaking scroll position maintenance

## 2.0.11
- Fix: Missing React import in a file

## 2.0.10
- Feat: Add onStickyHeaderChange callback for sticky headers
- Fix: Items with a falsy value like 0 were not rendering
- Fix: Column positions sometimes not calculating correctly
- Perf: updateItemsPositions was not breaking early sometimes
- Perf: Changed idCache to be an array instead of a Map for better performance
- Perf: Speed up container reuse lookups

## 2.0.9
- Fix: Improve initialScrollIndex accuracy and reliability

## 2.0.8
- Fix: Data changing sometimes left blank spaces because it was ignoring scroll
- Fix: Toggling between empty and non-empty causing maintainVisibleContentPosition issues

## 2.0.7
- Fix: Layout not working on react-native-macos because of transform instead of position

## 2.0.6
- Fix: updateItemPositions edge case with items multiple screen heights long was breaking the loop too early

## 2.0.5
- Perf: Change updateAllPositions to constrain processing to the scroll range
- Fix: Crash when using snapTo in some environments
- Perf: Change Separator to use useIsLastItem which should reduce the number of times it runs

## 2.0.4
- Fix: Possible crash if refScroller is undefined

## 2.0.3
- Feat: Set activeStickyIndex for usage in getState()
- Revert changes from 2.0.1 and 2.0.2 which were buggy in an edge case

## 2.0.2
- Fix: Performance improvement in 2.0.1 caused a bug in an edge case

## 2.0.1
- Perf: Improve performance in very long lists (bad release)

## 2.0.0
Major version release with significant performance improvements and architectural changes:
- Feat: Complete rewrite of virtualization algorithm for better performance
- Feat: Add sticky headers support via stickyIndices prop
- Feat: Add snapToIndices prop for snap-to behavior
- Feat: Add getItemType prop for better item type handling
- Feat: Add getFixedItemSize prop for items with known fixed sizes
- Feat: Add itemsAreEqual prop to reduce re-rendering when data changes
- Feat: Expose positions in getState()
- Feat: Add enableAverages prop to control average size calculations
- Feat: Add viewOffset option to scrollToEnd
- Feat: Improve maintainScrollAtEnd with more granular options
- Feat: Add ref function to enable/disable scroll processing
- Feat: Support lazy rendering directly in LegendList component
- Perf: Optimize container positioning using transform instead of absolute positioning
- Perf: Improve scroll buffering algorithm with directional bias
- Perf: Enable batched updates for better rendering performance
- Perf: Optimize container allocation and reuse algorithms
- Perf: Improve average item size calculations
- Fix: Improve maintainVisibleContentPosition reliability
- Fix: Better handling of data changes and scroll position maintenance
- Fix: Improve initial scroll positioning accuracy
- Fix: Better handling of padding changes
- Fix: Resolve various edge cases with container recycling
- Fix: Improve viewability calculations

## 1.1.4
- Feat: Add sizes to getState()

## 1.1.3
- Fix: scrollToEnd was not always setting `viewPosition: 1` correctly

## 1.1.2
- Fix: Adding items in a list with item separators had a small layout jump as the previously last item re-rendered with a separator

## 1.1.1
- Fix: scrollTo accuracy when paddingTop changes

## 1.1.0
- Feat: Add LazyLegendList component for virtualizing regular children
- Feat: Support initialScrollIndex with viewOffset and viewPosition
- Feat: Add estimatedListSize prop for better initial size estimation

## 1.0.20
- Types: Fix type of ref in Reanimated LegendList

## 1.0.19
- Fix: scrollToEnd not including footerSize

## 1.0.18
- Feat: Add a useListScrollSize hook
- Fix: Support renderItem being a function component
- Fix: scrollToEnd being incorrect by the amount of the bottom padding

## 1.0.17
- Fix: initialScrollIndex not taking header component size into account
- Fix: PaddingAndAdjust for ListHeaderComponent
- Fix: ignore alignItemsAtEnd when the list is empty

## 1.0.16
- Fix: isAtEnd was going to false when overscrolling
- Fix: refreshControl not being top padded correctly
- Fix: type of useLastItem hook
- Fix: header component was not displaying if a list had no data
- Fix: scrollToIndex logic that fixes scroll after items layout was not using viewPosition/viewOffset
- Fix: Improve scrollToIndex accuracy
- Fix: Improve scrollToEnd accuracy

## 1.0.15
- Feat: Add a useIsLastItem hook
- Feat: Support horizontal lists without an intrinsic height, it takes the maximum height of list items
- Feat: Add onLoad prop
- Fix: maintainVisibleContentPosition not working on horizontal lists
- Perf: scrollForNextCalculateItemsInView was not taking drawDistance into account correctly
- Perf: Improved the algorithm for allocating containers to items
- Perf: Use useLayoutEffect in LegendList if available to get the outer ScrollView layout as soon as possible

## 1.0.14
- Fix: A container changing size while inactive but not yet recycled could potentially overlap with elements onscreen if large enough

## 1.0.13
- Fix: Missing React import in ListHeaderComponentContainer crashing some environments
- Fix: `initialScrollIndex` was off by padding if using "padding" or "paddingVertical" props

## 1.0.12
- Fix: Initial scroll index and scrollTo were not compensating for top padding
- Fix: Removed an overly aggressive optimization that was sometimes causing blank spaces after scrolling
- Fix: Adding a lot of items to the end with maintainScrollAtEnd could result in a large blank space
- Fix: ListHeaderComponent sometimes not positioned correctly with maintainVisibleContentPosition
- Fix: Gap styles not working with maintainVisibleContentPosition

## 1.0.11
- Fix: scrollTo was sometimes showing gaps at the bottom or bottom after reaching the destination

## 1.0.10
- Fix: Removed an optimization that only checked newly visible items, which could sometimes cause gaps in lists
- Fix: Scroll history resets properly during scroll operations, which was causing gaps after scroll
- Fix: Made scroll buffer calculations and scroll jump handling more reliable

## 1.0.9
- Fix: Use the `use-sync-external-store` shim to support older versions of react
- Fix: Lists sometimes leaving some gaps when reordering a list
- Fix: Sometimes precomputing next scroll position for calculation incorrectly

## 1.0.8
- Perf: The scroll buffering algorithm is smarter and adjusts based on scroll direction for better performance
- Perf: The container-finding logic keeps index order, reducing gaps in rendering
- Perf: Combine multiple hooks in Container to a single `useArray$` hook

## 1.0.7
- Fix: Containers that move out of view are handled better

## 1.0.6
- Fix: Average item size calculations are more accurate while scrolling
- Fix: Items in view are handled better when data changes
- Fix: Scroll position is maintained more accurately during updates

## 1.0.5
- Fix: Fast scrolling sometimes caused elements to disappear
- Fix: Out-of-range `scrollToIndex` calls are handled better

## 1.0.4
- Fix: Container allocation is more efficient
- Fix: Bidirectional infinite lists scroll better on the old architecture
- Fix: Item size updates are handled more reliably
- Fix: Container reuse logic is more accurate
- Fix: Zero-size layouts are handled better in the old architecture

## 1.0.3
- Fix: Items that are larger than the estimated size are handled correctly

## 1.0.2
- Fix: Initial layout works better in the old architecture
- Fix: Average size calculations are more accurate for bidirectional scrolling
- Fix: Initial scroll index behavior is more precise
- Fix: Item size calculations are more accurate overall

## 1.0.1
- Fix: Total size calculations are correct when using average sizes
- Fix: Keyboard avoiding behavior is improved for a smoother experience

## 1.0.0
Initial release! Major changes if you're coming from a beta version:

- Item hooks like `useRecyclingState` are no longer render props, but can be imported directly from `@legendapp/list`.
