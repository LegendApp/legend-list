// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import type { ForwardedRef } from "react";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
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
import { useCombinedRef } from "@/hooks/useCombinedRef";
import { useOnLayoutSync } from "@/hooks/useOnLayoutSync";
import type { LegendListDatasetsProps, LegendListRef } from "@/types";
import { typedForwardRef, typedMemo } from "@/types";
import { getComponent } from "@/utils/getComponent";

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
        _forwardedRef: ForwardedRef<LegendListRef>,
    ) {
        const {
            datasets,
            renderItem,
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
            itemsAreEqual,
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
            stickyIndices,
            style: styleProp,
            suggestEstimatedItemSize,
            viewabilityConfig,
            viewabilityConfigCallbackPairs,
            waitForInitialLayout,
            stickyHeaderConfig,
            ItemSeparatorComponent,
            columnWrapperStyle,
            contentContainerStyle,
            dataVersion,
            alignItemsAtEnd,
            ...rest
        } = props;

        const refScroller = useRef<ScrollView>(null);
        const combinedRef = useCombinedRef(refScroller, refScrollView);

        // Track current scroll offset so we can pass it to a newly-activated dataset
        const currentScrollRef = useRef(0);

        // One ref slot per dataset, indexed by position
        const layerRefs = useRef<Array<DatasetLayerHandle | null>>([]);

        const activeIndex = datasets.findIndex((d) => d.active);
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
                if (activeIndex >= 0) {
                    layerRefs.current[activeIndex]?.onScrollOffset(offset);
                }
                onScrollProp?.(event);
            },
            [activeIndex, horizontal, onScrollProp],
        );

        const onLayoutChange = useCallback((layout: LayoutRectangle) => {
            // Propagate viewport size to ALL layers so each can allocate containers
            for (const ref of layerRefs.current) {
                ref?.setViewportLayout({
                    height: layout.height,
                    width: layout.width,
                    x: 0,
                    y: 0,
                });
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
                // All layers need the same header size for correct scroll calculations
                for (const ref of layerRefs.current) {
                    ref?.setHeaderSize(size);
                }
            },
            [horizontal],
        );

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
