import type { ForwardedRef } from "react";
import * as React from "react";
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
import { IsNewArchitecture } from "@/constants";
import { finishScrollTo } from "@/core/finishScrollTo";
import { scrollTo } from "@/core/scrollTo";
import { scrollToIndex } from "@/core/scrollToIndex";
import { useCombinedRef } from "@/hooks/useCombinedRef";
import { useOnLayoutSync } from "@/hooks/useOnLayoutSync";
import { listen$, peek$, type StateContext, set$ } from "@/state/state";
import type { LegendListDatasetsProps, LegendListRef, ScrollState } from "@/types";
import { typedForwardRef, typedMemo } from "@/types";
import { createColumnWrapperStyle } from "@/utils/createColumnWrapperStyle";
import { getComponent } from "@/utils/getComponent";
import { getId } from "@/utils/getId";
import { extractPadding } from "@/utils/helpers";

// Style applied to wrapper of each inactive dataset layer so it doesn't affect
// scroll content size while keeping native layout warm for instant reactivation.
const INACTIVE_LAYER_STYLE = StyleSheet.create({
    wrapper: {
        left: 0,
        opacity: 0,
        pointerEvents: "none",
        position: "absolute",
        right: 0,
        top: 0,
    },
}).wrapper;

function useLayerValue(
    ctx: StateContext | undefined,
    key: "alignItemsPaddingTop" | "scrollAdjust" | "scrollAdjustUserOffset",
) {
    const [value, setValue] = useState(() => (ctx ? (peek$(ctx, key) ?? 0) : 0));

    useEffect(() => {
        if (!ctx) {
            setValue(0);
            return;
        }

        setValue(peek$(ctx, key) ?? 0);
        return listen$(ctx, key, (next) => setValue(next ?? 0));
    }, [ctx, key]);

    return value;
}

function ActivePadding({ ctx }: { ctx: StateContext | undefined }) {
    const paddingTop = useLayerValue(ctx, "alignItemsPaddingTop");
    return <View style={{ paddingTop }} />;
}

function ActiveScrollAdjust({ ctx, horizontal }: { ctx: StateContext | undefined; horizontal: boolean }) {
    const bias = 10_000_000;
    const scrollAdjust = useLayerValue(ctx, "scrollAdjust");
    const scrollAdjustUserOffset = useLayerValue(ctx, "scrollAdjustUserOffset");
    const scrollOffset = scrollAdjust + scrollAdjustUserOffset + bias;

    return (
        <View
            style={{
                height: 0,
                left: horizontal ? scrollOffset : 0,
                position: "absolute",
                top: horizontal ? 0 : scrollOffset,
                width: 0,
            }}
        />
    );
}

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
            contentContainerStyle: contentContainerStyleProp,
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
        const sharedAnimatedScrollY = useRef(new Animated.Value(0)).current;

        // Track current scroll offset so we can pass it to a newly-activated dataset
        const currentScrollRef = useRef(0);

        // One ref slot per dataset, indexed by position
        const layerRefs = useRef<Array<DatasetLayerHandle | null>>([]);

        const activeIndex = datasets.findIndex((d) => d.active);
        // Stable ref so imperative handle methods always see the current active index
        const activeIndexRef = useRef(activeIndex);
        activeIndexRef.current = activeIndex;

        const prevActiveIndexRef = useRef(activeIndex);
        const [activeCtx, setActiveCtx] = useState<StateContext | undefined>(undefined);

        const contentContainerStyle = useMemo(
            () => ({ ...(StyleSheet.flatten(contentContainerStyleProp) || {}) }),
            [contentContainerStyleProp],
        );
        const style = useMemo(() => ({ ...(StyleSheet.flatten(styleProp) || {}) }), [styleProp]);
        const resolvedColumnWrapperStyle = useMemo(
            () => columnWrapperStyle || createColumnWrapperStyle(contentContainerStyle),
            [columnWrapperStyle, contentContainerStyle],
        );
        const stylePaddingTopState = extractPadding(style, contentContainerStyle, "Top");
        const stylePaddingBottomState = extractPadding(style, contentContainerStyle, "Bottom");

        const getActiveLayer = useCallback(() => {
            const index = activeIndexRef.current;
            return index >= 0 ? layerRefs.current[index] : undefined;
        }, []);

        const getActiveCtx = useCallback(() => getActiveLayer()?.getCtx(), [getActiveLayer]);

        const getActiveState = useCallback(() => getActiveLayer()?.getState(), [getActiveLayer]);

        // When active dataset changes, tell the newly active layer to catch up
        useLayoutEffect(() => {
            const prev = prevActiveIndexRef.current;
            prevActiveIndexRef.current = activeIndex;
            if (prev !== activeIndex && activeIndex >= 0) {
                layerRefs.current[activeIndex]?.activate(currentScrollRef.current);
            }
        }, [activeIndex]);

        useEffect(() => {
            setActiveCtx(getActiveCtx());
        }, [activeIndex, getActiveCtx]);

        const onScrollListener = useCallback(
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

        const onScrollHandler = useMemo(() => {
            if (stickyIndices?.length) {
                return Animated.event(
                    [{ nativeEvent: { contentOffset: { [horizontal ? "x" : "y"]: sharedAnimatedScrollY } } }],
                    {
                        listener: onScrollListener,
                        useNativeDriver: true,
                    },
                );
            }
            return onScrollListener;
        }, [horizontal, onScrollListener, sharedAnimatedScrollY, stickyIndices?.length]);

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

        const onLayoutFooter = useCallback(
            (rect: LayoutRectangle) => {
                const size = rect[horizontal ? "width" : "height"];
                for (const ref of layerRefs.current) {
                    ref?.setFooterSize(size);
                }
            },
            [horizontal],
        );

        // Subscribe to the active dataset's snapToOffsets so the ScrollView stays in sync
        const [snapOffsets, setSnapOffsets] = useState<number[] | undefined>(undefined);
        useEffect(() => {
            const ctx = getActiveCtx();
            setActiveCtx(ctx);
            if (!snapToIndices) {
                setSnapOffsets(undefined);
                return;
            }
            if (!ctx) return;
            setSnapOffsets(peek$(ctx, "snapToOffsets"));
            return listen$(ctx, "snapToOffsets", setSnapOffsets);
        }, [activeIndex, getActiveCtx, snapToIndices]);

        // Wire up the imperative ref — delegates to the active dataset's ctx/state
        useImperativeHandle(forwardedRef, () => {
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
                        const paddingBottom = state.props.stylePaddingBottom || 0;
                        const footerSize = peek$(ctx, "footerSize") || 0;
                        scrollToIndex(ctx, state, {
                            index,
                            viewOffset: -paddingBottom - footerSize + (options?.viewOffset || 0),
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
        }, [getActiveCtx, getActiveState]);

        const onMomentumScrollEndHandler = useCallback(
            (event: NativeSyntheticEvent<NativeScrollEvent>) => {
                const finishActiveScroll = () => {
                    const state = getActiveState();
                    if (state) {
                        finishScrollTo(state);
                    }
                };

                if (IsNewArchitecture) {
                    requestAnimationFrame(finishActiveScroll);
                } else {
                    setTimeout(finishActiveScroll, 1000);
                }

                onMomentumScrollEnd?.(event);
            },
            [getActiveState, onMomentumScrollEnd],
        );

        // Stabilize callbacks via refs so that un-memoized inline functions in the
        // parent don't invalidate sharedLayerProps and re-render all dataset layers.
        const renderItemRef = useRef(renderItem);
        renderItemRef.current = renderItem;
        const stableRenderItem = useCallback((p: any) => (renderItemRef.current as any)(p), []);

        const keyExtractorRef = useRef(keyExtractor);
        keyExtractorRef.current = keyExtractor;
        const stableKeyExtractor = keyExtractor
            ? useCallback((item: any, index: number) => keyExtractorRef.current!(item, index), [])
            : undefined;

        const onEndReachedRef = useRef(onEndReached);
        onEndReachedRef.current = onEndReached;
        const stableOnEndReached = onEndReached
            ? useCallback((info: any) => onEndReachedRef.current?.(info), [])
            : undefined;

        const onStartReachedRef = useRef(onStartReached);
        onStartReachedRef.current = onStartReached;
        const stableOnStartReached = onStartReached
            ? useCallback((info: any) => onStartReachedRef.current?.(info), [])
            : undefined;

        const onViewableItemsChangedRef = useRef(onViewableItemsChanged);
        onViewableItemsChangedRef.current = onViewableItemsChanged;
        const stableOnViewableItemsChanged = onViewableItemsChanged
            ? useCallback((info: any) => onViewableItemsChangedRef.current?.(info), [])
            : undefined;

        // Structural/layout props that legitimately need to re-propagate when changed.
        // Callbacks are excluded — they're stabilized via refs above.
        const sharedLayerProps = useMemo(
            () => ({
                alignItemsAtEnd,
                animatedScrollY: sharedAnimatedScrollY,
                columnWrapperStyle: resolvedColumnWrapperStyle,
                contentContainerStyle,
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
                initialScrollIndex,
                initialScrollOffset,
                itemsAreEqual,
                keyExtractor: stableKeyExtractor,
                maintainScrollAtEnd,
                maintainScrollAtEndThreshold,
                maintainVisibleContentPosition,
                numColumns,
                onEndReached: stableOnEndReached,
                onEndReachedThreshold,
                onItemSizeChanged,
                onLoad,
                onStartReached: stableOnStartReached,
                onStartReachedThreshold,
                onStickyHeaderChange,
                onViewableItemsChanged: stableOnViewableItemsChanged,
                recycleItems,
                renderItem: stableRenderItem,
                snapToIndices,
                stickyHeaderConfig,
                stickyIndices,
                stylePaddingBottom: stylePaddingBottomState,
                stylePaddingTop: stylePaddingTopState,
                suggestEstimatedItemSize,
                viewabilityConfig,
                viewabilityConfigCallbackPairs,
                waitForInitialLayout,
            }),
            [
                alignItemsAtEnd,
                contentContainerStyle,
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
                initialScrollIndex,
                initialScrollOffset,
                itemsAreEqual,
                maintainScrollAtEnd,
                maintainScrollAtEndThreshold,
                maintainVisibleContentPosition,
                numColumns,
                onEndReachedThreshold,
                onItemSizeChanged,
                onLoad,
                onStartReachedThreshold,
                onStickyHeaderChange,
                recycleItems,
                resolvedColumnWrapperStyle,
                sharedAnimatedScrollY,
                snapToIndices,
                stylePaddingBottomState,
                stylePaddingTopState,
                stickyHeaderConfig,
                stickyIndices,
                suggestEstimatedItemSize,
                viewabilityConfig,
                viewabilityConfigCallbackPairs,
                waitForInitialLayout,
            ],
        );

        const activeDataset = activeIndex >= 0 ? datasets[activeIndex] : undefined;
        const showEmpty = ListEmptyComponent && activeDataset && activeDataset.data.length === 0;

        return (
            <Animated.ScrollView
                {...rest}
                contentContainerStyle={[contentContainerStyle, horizontal ? { height: "100%" } : {}]}
                horizontal={horizontal}
                maintainVisibleContentPosition={maintainVisibleContentPosition ? { minIndexForVisible: 0 } : undefined}
                onLayout={onLayout}
                onMomentumScrollEnd={onMomentumScrollEndHandler}
                onScroll={onScrollHandler}
                ref={combinedRef}
                refreshControl={
                    refreshControl
                        ? stylePaddingTopState > 0
                            ? React.cloneElement(refreshControl, {
                                  progressViewOffset:
                                      (refreshControl.props.progressViewOffset || 0) + stylePaddingTopState,
                              })
                            : refreshControl
                        : onRefresh && (
                              <RefreshControl
                                  onRefresh={onRefresh}
                                  progressViewOffset={(progressViewOffset || 0) + stylePaddingTopState}
                                  refreshing={!!refreshing}
                              />
                          )
                }
                scrollEventThrottle={Platform.OS === "web" ? 16 : scrollEventThrottle}
                snapToOffsets={snapOffsets}
                style={style}
            >
                {maintainVisibleContentPosition && <ActiveScrollAdjust ctx={activeCtx} horizontal={!!horizontal} />}
                <ActivePadding ctx={activeCtx} />
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
                                dataVersion={dataset.dataVersion}
                                estimatedItemSize={dataset.estimatedItemSize ?? sharedLayerProps.estimatedItemSize}
                                getEstimatedItemSize={
                                    dataset.getEstimatedItemSize ?? sharedLayerProps.getEstimatedItemSize
                                }
                                getFixedItemSize={dataset.getFixedItemSize ?? sharedLayerProps.getFixedItemSize}
                                getItemType={dataset.getItemType ?? sharedLayerProps.getItemType}
                                keyExtractor={dataset.keyExtractor ?? sharedLayerProps.keyExtractor}
                                ref={(handle: DatasetLayerHandle | null) => {
                                    layerRefs.current[index] = handle;
                                }}
                                refScroller={refScroller}
                            />
                        </View>
                    ))}
                {ListFooterComponent && (
                    <LayoutView onLayoutChange={onLayoutFooter} style={ListFooterComponentStyle}>
                        {getComponent(ListFooterComponent)}
                    </LayoutView>
                )}
            </Animated.ScrollView>
        );
    }),
);
