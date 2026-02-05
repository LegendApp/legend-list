## Plan

Split public-facing types into base + platform-specific entrypoints, add `@legendapp/list/react-native` and `@legendapp/list/web` exports, and keep the root `@legendapp/list` typings permissive but complete.

## API & Behavior

- `@legendapp/list` remains usable without TS config changes, exposing `LegendList`, `LegendListProps`, and `LegendListRef` with base list props plus a loose `ScrollViewPropsLoose` surface.
- `ScrollViewPropsLoose` includes all `ScrollViewProps` keys; for each prop we compare RN 0.76 vs 0.83:
  - If the prop type is unchanged, we copy it into `ScrollViewPropsLoose`.
  - If it changed, we fall back to `any`/`unknown` to keep older versions supported.
- `@legendapp/list/react-native` exports the same symbols with strong React Native types.
- `@legendapp/list/web` exports the same symbols with strong DOM/CSS types.
- Public docs point users to the platform subpath for strict typings.

## Platform-Specific Props (Split)

These props will be typed differently in `react-native` vs `web` entrypoints:

- `style`
- `contentContainerStyle`
- `refScrollView`
- `renderScrollComponent`
- `onScroll`
- `onLayout`
- `refreshControl`
- All ScrollView pass-through props (RN `ScrollViewProps` + `ScrollViewPropsIOS` + `ScrollViewPropsAndroid` + `ViewProps` + `Touchable`), surfaced in:
  - `@legendapp/list/react-native` as RN types
  - `@legendapp/list/web` as `React.HTMLAttributes<HTMLElement>` (with overrides for `onScroll`, `onLayout`, `style`, `contentContainerStyle`, etc.)

Direct ScrollView prop names (from RN 0.76, to be validated against 0.83):

- `contentContainerStyle`
- `decelerationRate`
- `horizontal`
- `invertStickyHeaders`
- `keyboardDismissMode`
- `keyboardShouldPersistTaps`
- `onContentSizeChange`
- `onScroll`
- `onScrollBeginDrag`
- `onScrollEndDrag`
- `onMomentumScrollBegin`
- `onMomentumScrollEnd`
- `pagingEnabled`
- `scrollEnabled`
- `removeClippedSubviews`
- `showsHorizontalScrollIndicator`
- `showsVerticalScrollIndicator`
- `stickyHeaderHiddenOnScroll`
- `style`
- `refreshControl`
- `snapToInterval`
- `snapToOffsets`
- `snapToStart`
- `snapToEnd`
- `stickyHeaderIndices`
- `disableIntervalMomentum`
- `disableScrollViewPanResponder`
- `StickyHeaderComponent`

Direct ScrollView iOS prop names (from RN 0.76, to be validated against 0.83):

- `alwaysBounceHorizontal`
- `alwaysBounceVertical`
- `automaticallyAdjustContentInsets`
- `automaticallyAdjustKeyboardInsets`
- `automaticallyAdjustsScrollIndicatorInsets`
- `bounces`
- `bouncesZoom`
- `canCancelContentTouches`
- `centerContent`
- `contentInset`
- `contentOffset`
- `contentInsetAdjustmentBehavior`
- `directionalLockEnabled`
- `indicatorStyle`
- `maintainVisibleContentPosition`
- `maximumZoomScale`
- `minimumZoomScale`
- `onScrollAnimationEnd`
- `pinchGestureEnabled`
- `scrollEventThrottle`
- `scrollIndicatorInsets`
- `scrollToOverflowEnabled`
- `scrollsToTop`
- `snapToAlignment`
- `onScrollToTop`
- `zoomScale`

Direct ScrollView Android prop names (from RN 0.76, to be validated against 0.83):

- `endFillColor`
- `scrollPerfTag`
- `overScrollMode`
- `nestedScrollEnabled`
- `fadingEdgeLength`
- `persistentScrollbar`

## Core Implementation

- Introduce `src/types.base.ts` for platform-agnostic public types.
- Add `src/types.react-native.ts` to extend base props with RN `ScrollViewProps`, `StyleProp<ViewStyle>`, `Native*` event types, etc.
- Add `src/types.web.ts` to extend base props with DOM `CSSProperties`, `React.HTMLAttributes<HTMLElement>`, and web ref types.
- Create `ScrollViewPropsLoose` from the RN 0.76/0.83 comparison (copy stable prop types; `any`/`unknown` for changed props) for the root entrypoint.
- Add entrypoint files:
  - `src/react-native.ts` re-exporting `LegendList` + types from `types.react-native`.
  - `src/web.ts` re-exporting `LegendList` + types from `types.web`.
- Update `src/index.ts` to export base/loose public types for the root import.

## Build & Packaging

- Update `tsup.config.ts` entrypoints to emit `react-native` and `web` builds plus `react-native.native` for Metro.
- Update `package.json` `exports`:
  - `./react-native` → `react-native.js` + `react-native.native.js` + `react-native.d.ts`
  - `./web` → `web.js` + `web.d.ts`
- Keep root `react-native` field for runtime compatibility.
- Ensure output d.ts filenames are `react-native.d.ts` and `web.d.ts`.

## Tests

- Run `bun run tsc` to ensure base + platform typings compile.
- (If needed) add a small type-only compile test file that imports each entrypoint and exercises common props (no runtime tests).

## Docs

- Update `README.md` to recommend `@legendapp/list/react-native` and `@legendapp/list/web` for strict typings, while `@legendapp/list` remains permissive.

## Steps

- [x] Add base + platform-specific public type files and the loose `ScrollViewPropsLoose`.
- [ ] Add `react-native` and `web` entrypoints, update exports/build config, and verify `tsc` output.
- [ ] Update documentation to reflect the new import paths and typing guidance.
