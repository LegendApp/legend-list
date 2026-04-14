// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import type { ForwardedRef } from "react";
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    type LayoutRectangle,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    Platform,
    RefreshControl,
    type ScrollView,
    StyleSheet,
    View,
} from "react-native";

import { DatasetLayer, type DatasetLayerHandle } from "@/components/DatasetLayer";
import { LayoutView } from "@/components/LayoutView";
import { scrollTo } from "@/core/scrollTo";
import { scrollToIndex } from "@/core/scrollToIndex";
import { useCombinedRef } from "@/hooks/useCombinedRef";
import { useOnLayoutSync } from "@/hooks/useOnLayoutSync";
import { listen$, peek$, set$ } from "@/state/state";
import type { LegendListDatasetsProps, LegendListRef, ScrollState } from "@/types";
import { typedForwardRef, typedMemo } from "@/types";
import { getComponent } from "@/utils/getComponent";
import { getId } from "@/utils/getId";

// Style applied to wrapper of each inactive dataset layer so it takes no layout space
// and its contents (items at translateY: -9999) don't bleed into the visible area.
const INACTIVE_LAYER_STYLE = StyleSheet.create({
    wrapper: {
        height: 0,
        left: 0,
        overflow: "hidden",
        position: "absolute",
        right: 0,
        top: 0,
    },
}).wrapper;

export const LegendListDatasets = typedMemo(
    typedForwardRef(function LegendListDatasets<T>(
        props: LegendListDatasetsProps<T>,
        forwardedRef: ForwardedRef<LegendListRef>,
    ) {
        const {
            datasets,
            renderItem,
            alignItemsAtEnd,
            columnWrapperStyle,
            contentContainerStyle,
            dataVersion,
            drawDistance,
            enableAverages,
            estimatedItemSize,
            estimatedListSize,
            extraData,
            getEstimatedItemSize,
            getFixedItemSize,
            getItemType,
            horizontal,
            initialContainerPoolRatio,
            initialHeaderSize,
            initialScrollIndex,
            initialScrollOffset,
            itemsAreEqual,
            ItemSeparatorComponent,
            keyExtractor,
            ListEmptyComponent,
            ListHeaderComponent,
            ListHeaderComponentStyle,
            ListFooterComponent,
            ListFooterComponentStyle,
            maintainScrollAtEnd,
            maintainScrollAtEndThreshold,
            maintainVisibleContentPosition,
            numColumns,
            onEndReached,
            onEndReachedThreshold,
            onItemSizeChanged,
            onLayout: onLayoutProp,
            onLoad,
            onMomentumScrollEnd,
            onRefresh,
            onScroll: onScrollProp,
            onStartReached,
            onStartReachedThreshold,
            onStickyHeaderChange,
            onViewableItemsChanged,
            progressViewOffset,
            recycleItems,
            refreshControl,
            refreshing,
            refScrollView,
            scrollEventThrottle,
            snapToIndices,
            stickyHeaderConfig,
            stickyIndices,
            style: styleProp,
            suggestEstimatedItemSize,
            viewabilityConfig,
            viewabilityConfigCallbackPairs,
            waitForInitialLayout,
            ...rest
        } = props;

        const refScroller = useRef<ScrollView>(null);
        const combinedRef = useCombinedRef(refScroller, refScrollView);

        // Track current scroll offset so we can pass it to a newly-activated dataset
        const currentScrollRef = useRef(0);

        // One ref slot per dataset, indexed by position
        const layerRefs = useRef<Array<DatasetLayerHandle | null>>([]);

        const activeIndex = datasets.findIndex((d) => d.active);
        // Stable ref so imperative handle methods always see the current active index
        const activeIndexRef = useRef(activeIndex);
        activeIndexRef.current = activeIndex;

        const prevActiveIndexRef = useRef(activeIndex);

        // When active dataset changes, tell the newly active layer to catch up
        useLayoutEffect(() => {
            const prev = prevActiveIndexRef.current;
            prevActiveIndexRef.current = activeIndex;
            if (prev !== activeIndex && activeIndex >= 0) {
                layerRefs.current[activeIndex]?.activate(currentScrollRef.current);
            }
        }, [activeIndex]);

        const onScrollHandler = useCallback(
            (event: NativeSyntheticEvent<NativeScrollEvent>) => {
                const offset = event.nativeEvent.contentOffset[horizontal ? "x" : "y"];
                currentScrollRef.current = offset;
                const idx = activeIndexRef.current;
                if (idx >= 0) {
                    layerRefs.current[idx]?.onScrollOffset(offset);
                }
                onScrollProp?.(event);
            },
            [horizontal, onScrollProp],
        );

        const onLayoutChange = useCallback((layout: LayoutRectangle) => {
            // Propagate viewport size to ALL layers so each can allocate containers
            for (const ref of layerRefs.current) {
                ref?.setViewportLayout({ height: layout.height, width: layout.width, x: 0, y: 0 });
            }
        }, []);

        const { onLayout } = useOnLayoutSync({
            onLayoutChange,
            onLayoutProp,
            ref: refScroller as unknown as React.RefObject<View>,
        });

        const onLayoutHeader = useCallback(
            (rect: LayoutRectangle) => {
                const size = rect[horizontal ? "width" : "height"];
                for (const ref of layerRefs.current) {
                    ref?.setHeaderSize(size);
                }
            },
            [horizontal],
        );

        // Subscribe to the active dataset's snapToOffsets so the ScrollView stays in sync
        const [snapOffsets, setSnapOffsets] = useState<number[] | undefined>(undefined);
        useEffect(() => {
            if (!snapToIndices) {
                setSnapOffsets(undefined);
                return;
            }
            const activeLayer = layerRefs.current[activeIndex];
            if (!activeLayer) return;
            const ctx = activeLayer.getCtx();
            setSnapOffsets(peek$(ctx, "snapToOffsets"));
            return listen$(ctx, "snapToOffsets", setSnapOffsets);
        }, [activeIndex, snapToIndices]);

        // Wire up the imperative ref — delegates to the active dataset's ctx/state
        useImperativeHandle(forwardedRef, () => {
            const getActiveCtx = () => {
                const layer = layerRefs.current[activeIndexRef.current];
                return layer?.getCtx();
            };
            const getActiveState = () => {
                const layer = layerRefs.current[activeIndexRef.current];
                return layer?.getState();
            };

            const scrollIndexIntoView = (options: Parameters<LegendListRef["scrollIndexIntoView"]>[0]) => {
                const ctx = getActiveCtx();
                const state = getActiveState();
                if (!ctx || !state) return;
                const { index, ...rest } = options;
                const { startNoBuffer, endNoBuffer } = state;
                if (index < startNoBuffer || index > endNoBuffer) {
                    const viewPosition = index < startNoBuffer ? 0 : 1;
                    scrollToIndex(ctx, state, { ...rest, index, viewPosition });
                }
            };

            return {
                flashScrollIndicators: () => refScroller.current!.flashScrollIndicators(),
                getNativeScrollRef: () => refScroller.current!,
                getScrollableNode: () => refScroller.current!.getScrollableNode(),
                getScrollResponder: () => refScroller.current!.getScrollResponder(),
                getState: (): ScrollState => {
                    const state = getActiveState();
                    if (!state) return {} as ScrollState;
                    return {
                        activeStickyIndex: state.activeStickyIndex,
                        contentLength: state.totalSize,
                        data: state.props.data,
                        end: state.endNoBuffer,
                        endBuffered: state.endBuffered,
                        isAtEnd: state.isAtEnd,
                        isAtStart: state.isAtStart,
                        positionAtIndex: (index: number) => state.positions.get(getId(state, index))!,
                        positions: state.positions,
                        scroll: state.scroll,
                        scrollLength: state.scrollLength,
                        sizeAtIndex: (index: number) => state.sizesKnown.get(getId(state, index))!,
                        sizes: state.sizesKnown,
                        start: state.startNoBuffer,
                        startBuffered: state.startBuffered,
                    };
                },
                scrollIndexIntoView,
                scrollItemIntoView: ({ item, ...options }) => {
                    const state = getActiveState();
                    if (!state) return;
                    const index = state.props.data.indexOf(item);
                    if (index !== -1) scrollIndexIntoView({ index, ...options });
                },
                scrollToEnd: (options) => {
                    const ctx = getActiveCtx();
                    const state = getActiveState();
                    if (!ctx || !state) return;
                    const index = state.props.data.length - 1;
                    if (index !== -1) {
                        const footerSize = peek$(ctx, "footerSize") || 0;
                        scrollToIndex(ctx, state, {
                            index,
                            viewOffset: -footerSize + (options?.viewOffset || 0),
                            viewPosition: 1,
                            ...options,
                        });
                    }
                },
                scrollToIndex: (params) => {
                    const ctx = getActiveCtx();
                    const state = getActiveState();
                    if (ctx && state) scrollToIndex(ctx, state, params);
                },
                scrollToItem: ({ item, ...options }) => {
                    const ctx = getActiveCtx();
                    const state = getActiveState();
                    if (!ctx || !state) return;
                    const index = state.props.data.indexOf(item);
                    if (index !== -1) scrollToIndex(ctx, state, { index, ...options });
                },
                scrollToOffset: (params) => {
                    const state = getActiveState();
                    if (state) scrollTo(state, params);
                },
                setScrollProcessingEnabled: (enabled: boolean) => {
                    const state = getActiveState();
                    if (state) state.scrollProcessingEnabled = enabled;
                },
                setVisibleContentAnchorOffset: (value: number | ((value: number) => number)) => {
                    const ctx = getActiveCtx();
                    if (!ctx) return;
                    const val = typeof value === "function" ? value(peek$(ctx, "scrollAdjustUserOffset") || 0) : value;
                    set$(ctx, "scrollAdjustUserOffset", val);
                },
            };
        }, []);

        // Shared props forwarded to every DatasetLayer
        const sharedLayerProps = useMemo(
            () => ({
                alignItemsAtEnd,
                columnWrapperStyle,
                contentContainerStyle,
                dataVersion,
                drawDistance,
                enableAverages,
                estimatedItemSize,
                estimatedListSize,
                extraData,
                getEstimatedItemSize,
                getFixedItemSize,
                getItemType,
                horizontal,
                ItemSeparatorComponent,
                initialContainerPoolRatio,
                initialHeaderSize,
                initialScrollIndex,
                initialScrollOffset,
                itemsAreEqual,
                keyExtractor,
                maintainScrollAtEnd,
                maintainScrollAtEndThreshold,
                maintainVisibleContentPosition,
                numColumns,
                onEndReached,
                onEndReachedThreshold,
                onItemSizeChanged,
                onLoad,
                onStartReached,
                onStartReachedThreshold,
                onStickyHeaderChange,
                onViewableItemsChanged,
                recycleItems,
                renderItem,
                snapToIndices,
                stickyHeaderConfig,
                stickyIndices,
                suggestEstimatedItemSize,
                viewabilityConfig,
                viewabilityConfigCallbackPairs,
                waitForInitialLayout,
            }),
            [
                alignItemsAtEnd,
                columnWrapperStyle,
                contentContainerStyle,
                dataVersion,
                drawDistance,
                enableAverages,
                estimatedItemSize,
                estimatedListSize,
                extraData,
                getEstimatedItemSize,
                getFixedItemSize,
                getItemType,
                horizontal,
                initialContainerPoolRatio,
                initialHeaderSize,
                initialScrollIndex,
                initialScrollOffset,
                ItemSeparatorComponent,
                itemsAreEqual,
                keyExtractor,
                maintainScrollAtEnd,
                maintainScrollAtEndThreshold,
                maintainVisibleContentPosition,
                numColumns,
                onEndReached,
                onEndReachedThreshold,
                onItemSizeChanged,
                onLoad,
                onStartReached,
                onStartReachedThreshold,
                onStickyHeaderChange,
                onViewableItemsChanged,
                recycleItems,
                renderItem,
                snapToIndices,
                stickyHeaderConfig,
                stickyIndices,
                suggestEstimatedItemSize,
                viewabilityConfig,
                viewabilityConfigCallbackPairs,
                waitForInitialLayout,
            ],
        );

        const style = styleProp ? StyleSheet.flatten(styleProp) : undefined;

        const activeDataset = activeIndex >= 0 ? datasets[activeIndex] : undefined;
        const showEmpty = ListEmptyComponent && activeDataset && activeDataset.data.length === 0;

        return (
            <Animated.ScrollView
                {...rest}
                contentContainerStyle={contentContainerStyle}
                horizontal={horizontal}
                maintainVisibleContentPosition={maintainVisibleContentPosition ? { minIndexForVisible: 0 } : undefined}
                onLayout={onLayout}
                onMomentumScrollEnd={onMomentumScrollEnd}
                onScroll={onScrollHandler}
                ref={combinedRef}
                refreshControl={
                    refreshControl
                        ? refreshControl
                        : onRefresh && (
                              <RefreshControl
                                  onRefresh={onRefresh}
                                  progressViewOffset={progressViewOffset}
                                  refreshing={!!refreshing}
                              />
                          )
                }
                scrollEventThrottle={Platform.OS === "web" ? 16 : scrollEventThrottle}
                snapToOffsets={snapOffsets}
                style={style}
            >
                {ListHeaderComponent && (
                    <LayoutView onLayoutChange={onLayoutHeader} style={ListHeaderComponentStyle}>
                        {getComponent(ListHeaderComponent)}
                    </LayoutView>
                )}
                {showEmpty && getComponent(ListEmptyComponent)}
                {!showEmpty &&
                    datasets.map((dataset, index) => (
                        <View key={dataset.key} style={dataset.active ? undefined : INACTIVE_LAYER_STYLE}>
                            <DatasetLayer
                                {...sharedLayerProps}
                                active={dataset.active}
                                data={dataset.data}
                                ref={(handle: DatasetLayerHandle | null) => {
                                    layerRefs.current[index] = handle;
                                }}
                                refScroller={refScroller}
                            />
                        </View>
                    ))}
                {ListFooterComponent && (
                    <View style={ListFooterComponentStyle}>{getComponent(ListFooterComponent)}</View>
                )}
            </Animated.ScrollView>
        );
    }),
);
