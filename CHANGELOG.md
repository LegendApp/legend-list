## 2.0.19
- Fix: Add safety checks for getItemType, getEstimatedItemSize, getFixedItemSize, and keyExtractor to prevent calling when index is out of range
- Fix: Error with animatedProps in reanimated integration

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
