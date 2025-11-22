## Plan
Stand up a SectionList-compatible export on top of LegendList using stickyHeaderIndices-driven headers, keeping API parity with React Native while reusing existing virtualization.

## API Parity
- Mirror SectionList props (sections, renderSectionHeader/Footer, ItemSeparatorComponent, SectionSeparatorComponent, ListHeaderComponent/ListFooterComponent, stickySectionHeadersEnabled, keyExtractor, getItemLayout) and expose a typed ref with scrollToLocation.
- Accept LegendList tuning props (recycleItems, maintainScrollAtEnd, etc.) without breaking defaults; document unsupported combos like horizontal with sticky headers.
- Rename `stickyIndices` to `stickyHeaderIndices` for parity with React Native; keep a temporary alias with warnings and update docs/types.

## Flattening & Index Mapping
- Flatten sections into a linear data model tagged as header/item/footer/separators; compute stickyHeaderIndices for headers when stickySectionHeadersEnabled.
- Keep lookup tables to map flattened indices back to section/item for rendering, viewability, and scroll methods.
- Recompute flattening on sections/extraData/dataVersion changes and ensure stable keys per item/section.

## Rendering & Separators
- Wrap renderItem to dispatch by kind and call the correct user renderers; thread list/section separators and optional section footers.
- Handle ListEmptyComponent and ListHeader/ListFooter correctly when sections are empty; avoid column layouts for SectionList.

## Scrolling & Viewability
- Implement scrollToLocation and helpers by translating to LegendList scrollToIndex/scrollToOffset; honor viewOffset/viewPosition.
- Translate viewability callbacks to SectionList shape, preserving LegendList viewability optimizations.

## Testing & Docs
- Add unit tests for flattening, sticky header index generation, scrollToLocation mapping, and viewability translation; cover empty sections and sticky headers.
- Update README/docs with SectionList usage, stickyHeaderIndices rename (with migration guidance), and Animated.ScrollView requirement for sticky headers; export from package entry.

## Steps
- [ ] Define SectionList props/types/ref surface and expose it via the secondary `section-list` entrypoint (no change to the core LegendList export).
- [ ] Implement sections-to-flat data adapter with stickyHeaderIndices + render dispatch for headers/items/footers/separators.
- [ ] Wire ref methods/viewability translation and guard unsupported combos (e.g., horizontal + sticky).
- [ ] Rename `stickyIndices` API to `stickyHeaderIndices`, add alias/warnings, and update docs/types.
- [ ] Add tests and doc updates for SectionList usage and behavior.
- [ ] Ship as secondary entrypoint `@legendapp/list/section-list` (exports/typesVersions) to keep core bundle size unchanged.
