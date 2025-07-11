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
