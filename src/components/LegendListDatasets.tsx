// LegendListDatasets — outer orchestrator.
//
// Renders ONE outer ScrollView shared across N datasets, with ListHeaderComponent
// rendered exactly once. Each dataset gets its own <StateProvider> + <DatasetLayerInner>
// (headless), absolutely positioned inside a shared ContentArea.
//
// v1 architecture (see plan_legend_list_datasets_v1.md):
//   LegendListDatasets
//     └── ListComponentScrollView (shared scroll/layout/refScroller)
//           ├── ScrollAdjust (per-layer; rendered inside each layer)
//           ├── ListHeaderComponent (ONCE, fans headerSize to all layers)
//           ├── ContentArea (Animated height = active layer's totalSize)
//           │     ├── <StateProvider> dataset 0
//           │     │     └── <DatasetLayerInner /> (absolute)
//           │     └── ... × N
//           └── ListFooterComponent (ONCE, fans footerSize to all layers)
//
// Known v1 limitations:
//   - Sticky headers across datasets: outer onScroll is not yet sticky-aware.
//     If you need sticky behavior, use the single-dataset <LegendList>.
//   - initialScroll uses the active dataset at mount; switching datasets later
//     does not auto-scroll.

import * as React from "react";
import {
    type ForwardedRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Animated, View } from "react-native";

import { type DatasetLayerHandle, DatasetLayerInner } from "@/components/DatasetLayerInner";
import { ListComponentScrollView } from "@/components/ListComponentScrollView";
import { IsNewArchitecture } from "@/constants-platform";
import {
    handleBootstrapInitialScrollFooterLayout,
    handleBootstrapInitialScrollLayoutChange,
} from "@/core/bootstrapInitialScroll";
import { checkFinishedScrollFallback } from "@/core/checkFinishedScroll";
import { handleLayout } from "@/core/handleLayout";
import { advanceCurrentInitialScrollSession, resolveInitialScrollOffset } from "@/core/initialScroll";
import { initializeInitialScrollOnMount } from "@/core/initialScrollLifecycle";
import { onScroll as routeOnScroll } from "@/core/onScroll";
import { maybeUpdateAnchoredEndSpace } from "@/core/updateAnchoredEndSpace";
import { updateScroll } from "@/core/updateScroll";
import { useCombinedRef } from "@/hooks/useCombinedRef";
import { useOnLayoutSync } from "@/hooks/useOnLayoutSync";
import { createAnimatedValue } from "@/platform/Animated";
import { LayoutView } from "@/platform/LayoutView";
import { Platform } from "@/platform/Platform";
import { RefreshControl } from "@/platform/RefreshControl";
import { StyleSheet } from "@/platform/StyleSheet";
import type {
    LayoutRectangle,
    LooseScrollViewProps,
    LooseView,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ViewStyle,
} from "@/platform/scrollview-types";
import { listen$, peek$, StateProvider, set$ } from "@/state/state";
import type { LegendListRef, LegendListRenderItemProps } from "@/types.base";
import type { LegendListPropsBase, LegendListScrollerRef } from "@/types.internal";
import { typedForwardRef, typedMemo } from "@/types.internal";
import { getComponent } from "@/utils/getComponent";
import { extractPadding } from "@/utils/helpers";
import { normalizeMaintainVisibleContentPosition } from "@/utils/normalizeMaintainVisibleContentPosition";
import { useThrottledOnScroll } from "@/utils/throttledOnScroll";

const Activity = React.Activity;

type SharedScrollRef = LegendListScrollerRef & LooseView;
type LayoutEventLike = { nativeEvent: { layout: LayoutRectangle } };
type ScrollEventLike = {
    nativeEvent: {
        contentInset?: NativeScrollEvent["contentInset"];
        contentOffset: NativeScrollEvent["contentOffset"];
        contentSize?: NativeScrollEvent["contentSize"];
        layoutMeasurement?: NativeScrollEvent["layoutMeasurement"];
        zoomScale?: NativeScrollEvent["zoomScale"];
    };
};

const DEFAULT_CONTENT_INSET: NativeScrollEvent["contentInset"] = {
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
};

const DEFAULT_SCROLL_SIZE = { height: 0, width: 0 };

function normalizeScrollEvent(event: ScrollEventLike): NativeSyntheticEvent<NativeScrollEvent> {
    return {
        nativeEvent: {
            contentInset: event.nativeEvent.contentInset ?? DEFAULT_CONTENT_INSET,
            contentOffset: event.nativeEvent.contentOffset,
            contentSize: event.nativeEvent.contentSize ?? DEFAULT_SCROLL_SIZE,
            layoutMeasurement: event.nativeEvent.layoutMeasurement ?? DEFAULT_SCROLL_SIZE,
            zoomScale: event.nativeEvent.zoomScale ?? 1,
        },
    };
}

interface DatasetLayerShellProps {
    children: React.ReactNode;
    inactiveDatasetBehavior: DatasetInactiveBehavior;
    isActive: boolean;
}

function DatasetLayerShell({ children, inactiveDatasetBehavior, isActive }: DatasetLayerShellProps) {
    const shouldPauseLayer = !isActive && inactiveDatasetBehavior === "pause";
    const shouldHideLayer = !isActive && (shouldPauseLayer || inactiveDatasetBehavior === "hide");

    return (
        <View aria-hidden={shouldHideLayer} pointerEvents={isActive ? "auto" : "none"} style={styles.layerRoot}>
            <Activity mode={shouldPauseLayer ? "hidden" : "visible"}>
                <View style={shouldHideLayer ? styles.layerHidden : styles.layerVisible}>{children}</View>
            </Activity>
        </View>
    );
}

export type DatasetInactiveBehavior = "pause" | "hide" | "unmount";

export interface LegendListDataset<T> {
    key: string;
    data: ReadonlyArray<T>;
}

export type LegendListDatasetRenderItemProps<T> = LegendListRenderItemProps<T, string | undefined> & {
    datasetKey: string;
};

export type LegendListDatasetsProps<T, TScrollViewProps = LooseScrollViewProps> = Omit<
    LegendListPropsBase<T, TScrollViewProps>,
    "children" | "data" | "getEstimatedItemSize" | "getFixedItemSize" | "getItemType" | "keyExtractor" | "renderItem"
> & {
    activeDatasetKey: string;
    datasets: ReadonlyArray<LegendListDataset<T>>;
    getEstimatedItemSize?: (item: T, index: number, type: string | undefined, datasetKey: string) => number;
    getFixedItemSize?: (item: T, index: number, type: string | undefined, datasetKey: string) => number | undefined;
    getItemType?: (item: T, index: number, datasetKey: string) => string | undefined;
    inactiveDatasetBehavior?: DatasetInactiveBehavior;
    keyExtractor?: (item: T, index: number, datasetKey: string) => string;
    renderItem: (props: LegendListDatasetRenderItemProps<T>) => React.ReactNode;
    /** Delay (ms) before mounting non-active datasets on first paint. Default 100. */
    staggerMountMs?: number;
};

const styles = StyleSheet.create({
    layerHidden: {
        display: "none" as const,
        flex: 1,
    },
    layerRoot: {
        bottom: 0,
        left: 0,
        position: "absolute" as const,
        right: 0,
        top: 0,
    },
    layerVisible: {
        display: "flex" as const,
        flex: 1,
    },
});

export const LegendListDatasets = typedMemo(
    // biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
    typedForwardRef(function LegendListDatasets<T>(
        props: LegendListDatasetsProps<T>,
        forwardedRef: ForwardedRef<LegendListRef>,
    ) {
        const {
            activeDatasetKey,
            alignItemsAtEnd = false,
            anchoredEndSpace,
            alwaysRender,
            columnWrapperStyle,
            contentContainerClassName,
            contentInset,
            contentInsetEndAdjustment,
            contentContainerStyle: contentContainerStyleProp,
            dataVersion,
            datasets,
            drawDistance,
            estimatedHeaderSize,
            estimatedListSize,
            estimatedItemSize,
            extraData,
            getEstimatedItemSize,
            getFixedItemSize,
            getItemType,
            inactiveDatasetBehavior = "pause",
            initialContainerPoolRatio,
            initialScrollAtEnd,
            initialScrollIndex,
            initialScrollOffset,
            itemsAreEqual,
            ItemSeparatorComponent,
            keyExtractor,
            staggerMountMs = 100,
            ListHeaderComponent,
            ListHeaderComponentStyle,
            ListFooterComponent,
            ListFooterComponentStyle,
            ListEmptyComponent,
            maintainScrollAtEnd,
            maintainScrollAtEndThreshold,
            maintainVisibleContentPosition,
            numColumns,
            overrideItemLayout,
            onEndReached,
            onEndReachedThreshold,
            onItemSizeChanged,
            onLayout: onLayoutProp,
            onLoad,
            onMetricsChange,
            onMomentumScrollEnd,
            onRefresh,
            onScroll: onScrollProp,
            onStartReached,
            onStartReachedThreshold,
            onStickyHeaderChange,
            onViewableItemsChanged,
            refreshControl,
            refreshing,
            refScrollView,
            renderItem,
            renderScrollComponent,
            rtl,
            scrollEventThrottle,
            showsHorizontalScrollIndicator,
            showsVerticalScrollIndicator,
            snapToIndices,
            stickyHeaderConfig,
            stickyHeaderIndices,
            stickyIndices,
            style: styleProp,
            progressViewOffset,
            horizontal,
            recycleItems,
            useWindowScroll,
            viewabilityConfig,
            viewabilityConfigCallbackPairs,
            ...scrollProps
        } = props;

        const datasetKeys = datasets.map((d) => d.key).join("\u0000");
        const datasetCallbacks = useMemo(() => {
            const callbacks = new Map<
                string,
                {
                    getEstimatedItemSize?: (item: T, index: number, type: string | undefined) => number;
                    getFixedItemSize?: (item: T, index: number, type: string | undefined) => number | undefined;
                    getItemType?: (item: T, index: number) => string | undefined;
                    keyExtractor?: (item: T, index: number) => string;
                    renderItem: (props: LegendListRenderItemProps<T, string | undefined>) => React.ReactNode;
                }
            >();

            for (const dataset of datasets) {
                const datasetKey = dataset.key;
                callbacks.set(datasetKey, {
                    getEstimatedItemSize: getEstimatedItemSize
                        ? (item, index, type) => getEstimatedItemSize(item, index, type, datasetKey)
                        : undefined,
                    getFixedItemSize: getFixedItemSize
                        ? (item, index, type) => getFixedItemSize(item, index, type, datasetKey)
                        : undefined,
                    getItemType: getItemType ? (item, index) => getItemType(item, index, datasetKey) : undefined,
                    keyExtractor: keyExtractor ? (item, index) => keyExtractor(item, index, datasetKey) : undefined,
                    renderItem: (itemProps) => renderItem({ ...itemProps, datasetKey }),
                });
            }

            return callbacks;
        }, [datasetKeys, getEstimatedItemSize, getFixedItemSize, getItemType, keyExtractor, renderItem]);

        // Shared resources.
        const sharedAnimatedScrollY = useRef(createAnimatedValue(0)).current;
        const sharedRefScroller = useRef<SharedScrollRef | null>(null);
        const refScroller = useRef<SharedScrollRef | null>(null);
        const combinedRef = useCombinedRef(refScroller, sharedRefScroller, refScrollView);
        const sharedContentHeight = useRef(new Animated.Value(0)).current;
        const latestLayoutRef = useRef<{ fromLayoutEffect: boolean; layout: LayoutRectangle } | undefined>(undefined);
        const latestHeaderSizeRef = useRef<number | undefined>(ListHeaderComponent ? undefined : 0);
        const latestFooterSizeRef = useRef<number | undefined>(ListFooterComponent ? undefined : 0);
        const latestScrollEventRef = useRef<NativeSyntheticEvent<NativeScrollEvent> | undefined>(undefined);

        // Layer registry. Mutations don't trigger re-render by themselves;
        // we bump layerVersion when registrations change so effects can re-bind.
        const layersRef = useRef<Map<string, DatasetLayerHandle>>(new Map());
        const [layerVersion, setLayerVersion] = useState(0);

        const registerLayer = useCallback((key: string, handle: DatasetLayerHandle | null) => {
            if (handle) {
                layersRef.current.set(key, handle);
            } else {
                layersRef.current.delete(key);
            }
            setLayerVersion((v) => v + 1);
        }, []);

        const resolvedActiveDatasetKey = datasets.length === 0 ? "" : activeDatasetKey;
        const activeDataset = datasets.find((d) => d.key === resolvedActiveDatasetKey);

        // Track which dataset keys are mounted (active + staggered others).
        const [mountedKeys, setMountedKeys] = useState<Set<string>>(() => new Set([resolvedActiveDatasetKey]));
        const everActiveRef = useRef<Set<string>>(new Set([resolvedActiveDatasetKey]));
        if (!everActiveRef.current.has(resolvedActiveDatasetKey)) {
            everActiveRef.current.add(resolvedActiveDatasetKey);
        }
        useEffect(() => {
            if (staggerMountMs <= 0) {
                setMountedKeys(new Set(datasets.map((d) => d.key)));
                return;
            }
            const t = setTimeout(() => {
                setMountedKeys(new Set(datasets.map((d) => d.key)));
            }, staggerMountMs);
            return () => clearTimeout(t);
        }, [staggerMountMs, datasetKeys]);

        const applyLayoutToLayer = useCallback(
            (layer: DatasetLayerHandle, layout: LayoutRectangle, fromLayoutEffect: boolean) => {
                const previousScrollLength = layer.ctx.state.scrollLength;
                const previousOtherAxisSize = layer.ctx.state.otherAxisSize;
                handleLayout(layer.ctx, layout, layer.setCanRender);
                maybeUpdateAnchoredEndSpace(layer.ctx);
                const didLayoutAffectBootstrap =
                    previousScrollLength !== layer.ctx.state.scrollLength ||
                    previousOtherAxisSize !== layer.ctx.state.otherAxisSize;
                if (layer.usesBootstrapInitialScroll && !fromLayoutEffect && didLayoutAffectBootstrap) {
                    handleBootstrapInitialScrollLayoutChange(layer.ctx);
                }
                if (!layer.usesBootstrapInitialScroll) {
                    advanceCurrentInitialScrollSession(layer.ctx);
                }
            },
            [],
        );

        const applyFooterSizeToLayer = useCallback((layer: DatasetLayerHandle, size: number) => {
            set$(layer.ctx, "footerSize", size);
            if (layer.usesBootstrapInitialScroll) {
                handleBootstrapInitialScrollFooterLayout(layer.ctx, {
                    dataLength: layer.dataLength,
                    footerSize: size,
                    initialScrollAtEnd: !!layer.initialScroll?.preserveForBottomPadding,
                    stylePaddingBottom: layer.stylePaddingBottom,
                });
            }
        }, []);

        const syncLayerToCurrentScroll = useCallback((layer: DatasetLayerHandle) => {
            if (latestScrollEventRef.current) {
                routeOnScroll(layer.ctx, latestScrollEventRef.current);
                return;
            }

            const currentOffset = refScroller.current?.getCurrentScrollOffset?.();
            if (typeof currentOffset === "number") {
                updateScroll(layer.ctx, currentOffset, true);
            }
        }, []);

        useLayoutEffect(() => {
            for (const [key, layer] of layersRef.current) {
                if (latestHeaderSizeRef.current !== undefined) {
                    set$(layer.ctx, "headerSize", latestHeaderSizeRef.current);
                }

                if (latestFooterSizeRef.current !== undefined) {
                    applyFooterSizeToLayer(layer, latestFooterSizeRef.current);
                }

                if (latestLayoutRef.current) {
                    applyLayoutToLayer(layer, latestLayoutRef.current.layout, latestLayoutRef.current.fromLayoutEffect);
                }

                if (key === resolvedActiveDatasetKey) {
                    syncLayerToCurrentScroll(layer);
                }
            }
        }, [
            resolvedActiveDatasetKey,
            applyFooterSizeToLayer,
            applyLayoutToLayer,
            layerVersion,
            syncLayerToCurrentScroll,
        ]);

        // Sync ContentArea height to active layer's totalSize.
        useEffect(() => {
            const activeLayer = layersRef.current.get(resolvedActiveDatasetKey);
            if (!activeLayer) return;
            const sync = () => {
                const v = peek$(activeLayer.ctx, "totalSize") || 0;
                sharedContentHeight.setValue(v);
            };
            sync();
            return listen$(activeLayer.ctx, "totalSize", sync);
        }, [resolvedActiveDatasetKey, layerVersion, sharedContentHeight]);

        // Bootstrap initial scroll once, using the ACTIVE layer's intent (if any).
        const didBootstrapRef = useRef(false);
        useEffect(() => {
            if (didBootstrapRef.current) return;
            const activeLayer = layersRef.current.get(resolvedActiveDatasetKey);
            if (!activeLayer) return;
            didBootstrapRef.current = true;

            const initialScroll = activeLayer.initialScroll;
            const usesBootstrap = activeLayer.usesBootstrapInitialScroll;
            const initialContentOffset = initialScroll
                ? (initialScroll.contentOffset ?? resolveInitialScrollOffset(activeLayer.ctx, initialScroll))
                : undefined;

            initializeInitialScrollOnMount(activeLayer.ctx, {
                alwaysDispatchInitialScroll: false,
                dataLength: activeLayer.dataLength,
                hasFooterComponent: !!ListFooterComponent,
                initialContentOffset,
                initialScrollAtEnd: !!initialScroll?.preserveForBottomPadding,
                useBootstrapInitialScroll: usesBootstrap,
            });

            if (Platform.OS === "web" && !usesBootstrap) {
                advanceCurrentInitialScrollSession(activeLayer.ctx);
            }
        }, [resolvedActiveDatasetKey, layerVersion, ListFooterComponent]);

        // Layout fan-out: invoke handleLayout for every registered layer.
        const onLayoutChange = useCallback(
            (layout: LayoutRectangle, fromLayoutEffect: boolean) => {
                latestLayoutRef.current = { fromLayoutEffect, layout };
                for (const layer of layersRef.current.values()) {
                    applyLayoutToLayer(layer, layout, fromLayoutEffect);
                }
            },
            [applyLayoutToLayer],
        );

        const { onLayout } = useOnLayoutSync({
            onLayoutChange,
            onLayoutProp,
            ref: refScroller,
        });
        const noopOnLayout = useCallback((_event: LayoutEventLike) => {}, []);
        const onLayoutHandler = onLayout ?? noopOnLayout;

        // Scroll routing: only update the active layer's ctx.scroll.
        const baseOnScroll = useCallback(
            (event: NativeSyntheticEvent<NativeScrollEvent>) => {
                latestScrollEventRef.current = event;
                const activeLayer = layersRef.current.get(resolvedActiveDatasetKey);
                if (activeLayer) {
                    routeOnScroll(activeLayer.ctx, event);
                }
            },
            [resolvedActiveDatasetKey],
        );
        const noopOnScroll = useCallback((_event: NativeSyntheticEvent<NativeScrollEvent>) => {}, []);
        const throttledOnScroll = useThrottledOnScroll(onScrollProp ?? noopOnScroll, scrollEventThrottle ?? 0);
        const propScroll = scrollEventThrottle && onScrollProp ? throttledOnScroll : onScrollProp;

        const onScrollHandler = useCallback(
            (event: ScrollEventLike) => {
                const normalizedEvent = normalizeScrollEvent(event);
                baseOnScroll(normalizedEvent);
                propScroll?.(normalizedEvent);
            },
            [baseOnScroll, propScroll],
        );

        const onMomentumScrollEndHandler = useCallback(
            (event: ScrollEventLike) => {
                const normalizedEvent = normalizeScrollEvent(event);
                const activeLayer = layersRef.current.get(resolvedActiveDatasetKey);
                if (activeLayer) {
                    checkFinishedScrollFallback(activeLayer.ctx);
                }
                onMomentumScrollEnd?.(normalizedEvent);
            },
            [resolvedActiveDatasetKey, onMomentumScrollEnd],
        );

        // Header / footer fan-out.
        const onLayoutHeader = useCallback(
            (rect: LayoutRectangle) => {
                const size = rect[horizontal ? "width" : "height"];
                latestHeaderSizeRef.current = size;
                for (const layer of layersRef.current.values()) {
                    set$(layer.ctx, "headerSize", size);
                }
            },
            [horizontal],
        );

        const onLayoutFooterInternal = useCallback(
            (rect: LayoutRectangle, _fromLayoutEffect: boolean) => {
                const size = rect[horizontal ? "width" : "height"];
                latestFooterSizeRef.current = size;
                for (const layer of layersRef.current.values()) {
                    applyFooterSizeToLayer(layer, size);
                }
            },
            [applyFooterSizeToLayer, horizontal],
        );

        useLayoutEffect(() => {
            if (ListHeaderComponent) {
                return;
            }

            latestHeaderSizeRef.current = 0;
            for (const layer of layersRef.current.values()) {
                set$(layer.ctx, "headerSize", 0);
            }
        }, [ListHeaderComponent, layerVersion]);

        useLayoutEffect(() => {
            if (ListFooterComponent) {
                return;
            }

            latestFooterSizeRef.current = 0;
            for (const layer of layersRef.current.values()) {
                applyFooterSizeToLayer(layer, 0);
            }
        }, [ListFooterComponent, applyFooterSizeToLayer, layerVersion]);

        // Imperative ref forwards to active layer's imperative handle.
        const layerRefs = useRef<Map<string, LegendListRef | null>>(new Map());
        const getActiveLayerRef = useCallback(() => {
            const activeLayerRef = layerRefs.current.get(resolvedActiveDatasetKey);
            if (!activeLayerRef) {
                throw new Error("[legend-list] Active dataset layer is not mounted.");
            }
            return activeLayerRef;
        }, [resolvedActiveDatasetKey]);
        useImperativeHandle(
            forwardedRef,
            () => ({
                clearCaches: (options) => getActiveLayerRef().clearCaches(options),
                flashScrollIndicators: () => getActiveLayerRef().flashScrollIndicators(),
                getNativeScrollRef: () => getActiveLayerRef().getNativeScrollRef(),
                getScrollableNode: () => getActiveLayerRef().getScrollableNode(),
                getScrollResponder: () => getActiveLayerRef().getScrollResponder(),
                getState: () => getActiveLayerRef().getState(),
                reportContentInset: (inset) => getActiveLayerRef().reportContentInset(inset),
                scrollIndexIntoView: (params) => getActiveLayerRef().scrollIndexIntoView(params),
                scrollItemIntoView: (params) => getActiveLayerRef().scrollItemIntoView(params),
                scrollToEnd: (options) => getActiveLayerRef().scrollToEnd(options),
                scrollToIndex: (params) => getActiveLayerRef().scrollToIndex(params),
                scrollToItem: (params) => getActiveLayerRef().scrollToItem(params),
                scrollToOffset: (params) => getActiveLayerRef().scrollToOffset(params),
                setScrollProcessingEnabled: (enabled) => getActiveLayerRef().setScrollProcessingEnabled(enabled),
                setVisibleContentAnchorOffset: (value) => getActiveLayerRef().setVisibleContentAnchorOffset(value),
            }),
            [getActiveLayerRef],
        );

        // Padding (for refresh control offset) — same derivation as LegendListInner.
        const style: ViewStyle = StyleSheet.flatten(styleProp) ?? {};
        const contentContainerStyleBase: ViewStyle | undefined = StyleSheet.flatten(contentContainerStyleProp);
        const shouldFlexGrow =
            alignItemsAtEnd &&
            (horizontal ? contentContainerStyleBase?.minWidth == null : contentContainerStyleBase?.minHeight == null);
        const maintainVisibleContentPositionConfig =
            normalizeMaintainVisibleContentPosition(maintainVisibleContentPosition);
        const contentContainerStyle: ViewStyle = {
            ...contentContainerStyleBase,
            ...(alignItemsAtEnd
                ? {
                      display: "flex",
                      flexDirection: horizontal ? "row" : "column",
                      ...(shouldFlexGrow ? { flexGrow: 1 } : {}),
                      justifyContent: "flex-end",
                  }
                : {}),
        };
        const stylePaddingTopState = extractPadding(style, contentContainerStyle, "Top");

        const refreshControlElement = React.isValidElement<{ progressViewOffset?: number }>(refreshControl)
            ? refreshControl
            : undefined;
        const resolvedRefreshControl = refreshControlElement
            ? stylePaddingTopState > 0
                ? React.cloneElement(refreshControlElement, {
                      progressViewOffset: (refreshControlElement.props.progressViewOffset ?? 0) + stylePaddingTopState,
                  })
                : refreshControlElement
            : onRefresh && (
                  <RefreshControl
                      onRefresh={onRefresh}
                      progressViewOffset={(progressViewOffset || 0) + stylePaddingTopState}
                      refreshing={!!refreshing}
                  />
              );

        // Resolve which scroll component to render.
        const ScrollComponent = useMemo(() => {
            if (!renderScrollComponent) return ListComponentScrollView;
            return React.forwardRef((p: LooseScrollViewProps, ref) => renderScrollComponent({ ...p, ref }));
        }, [renderScrollComponent]);

        const contentAreaStyle: Animated.WithAnimatedValue<ViewStyle> = horizontal
            ? { height: "100%", width: sharedContentHeight }
            : { height: sharedContentHeight, width: "100%" };

        return (
            <ScrollComponent
                {...scrollProps}
                contentContainerClassName={contentContainerClassName}
                contentContainerStyle={contentContainerStyle}
                contentInset={contentInset}
                horizontal={horizontal}
                maintainVisibleContentPosition={
                    maintainVisibleContentPositionConfig.size || maintainVisibleContentPositionConfig.data
                        ? { minIndexForVisible: 0 }
                        : undefined
                }
                onLayout={onLayoutHandler}
                onMomentumScrollEnd={onMomentumScrollEndHandler}
                onScroll={onScrollHandler}
                ref={combinedRef}
                refreshControl={resolvedRefreshControl}
                scrollEventThrottle={scrollEventThrottle ?? 0}
                showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
                showsVerticalScrollIndicator={showsVerticalScrollIndicator}
                style={style}
                {...(renderScrollComponent ? {} : { useWindowScroll })}
            >
                {ListHeaderComponent && (
                    <LayoutView onLayoutChange={onLayoutHeader} style={ListHeaderComponentStyle}>
                        {getComponent(ListHeaderComponent)}
                    </LayoutView>
                )}

                {ListEmptyComponent &&
                    (datasets.length === 0 || activeDataset?.data.length === 0) &&
                    getComponent(ListEmptyComponent)}

                <Animated.View style={contentAreaStyle}>
                    {datasets.map((ds) => {
                        const isActive = ds.key === resolvedActiveDatasetKey;
                        const shouldRender =
                            inactiveDatasetBehavior === "unmount"
                                ? isActive
                                : mountedKeys.has(ds.key) || everActiveRef.current.has(ds.key) || isActive;

                        if (!shouldRender) return null;

                        const callbacks = datasetCallbacks.get(ds.key);
                        if (!callbacks) return null;

                        return (
                            <DatasetLayerShell
                                inactiveDatasetBehavior={inactiveDatasetBehavior}
                                isActive={isActive}
                                key={ds.key}
                            >
                                <StateProvider>
                                    <DatasetLayerInner
                                        alignItemsAtEnd={alignItemsAtEnd}
                                        alwaysRender={alwaysRender}
                                        anchoredEndSpace={anchoredEndSpace}
                                        columnWrapperStyle={columnWrapperStyle}
                                        contentContainerStyle={contentContainerStyle}
                                        contentInset={contentInset}
                                        contentInsetEndAdjustment={contentInsetEndAdjustment}
                                        data={ds.data}
                                        dataVersion={dataVersion}
                                        drawDistance={drawDistance}
                                        estimatedHeaderSize={estimatedHeaderSize}
                                        estimatedItemSize={estimatedItemSize}
                                        estimatedListSize={estimatedListSize}
                                        extraData={extraData}
                                        getEstimatedItemSize={callbacks.getEstimatedItemSize}
                                        getFixedItemSize={callbacks.getFixedItemSize}
                                        getItemType={callbacks.getItemType}
                                        horizontal={horizontal}
                                        ItemSeparatorComponent={ItemSeparatorComponent}
                                        initialContainerPoolRatio={initialContainerPoolRatio}
                                        initialScrollAtEnd={initialScrollAtEnd}
                                        initialScrollIndex={initialScrollIndex}
                                        initialScrollOffset={initialScrollOffset}
                                        isActive={isActive}
                                        itemsAreEqual={itemsAreEqual}
                                        keyExtractor={callbacks.keyExtractor}
                                        layerKey={ds.key}
                                        maintainScrollAtEnd={maintainScrollAtEnd}
                                        maintainScrollAtEndThreshold={maintainScrollAtEndThreshold}
                                        maintainVisibleContentPosition={maintainVisibleContentPosition}
                                        numColumns={numColumns}
                                        onEndReached={onEndReached}
                                        onEndReachedThreshold={onEndReachedThreshold}
                                        onItemSizeChanged={onItemSizeChanged}
                                        onLoad={onLoad}
                                        onMetricsChange={onMetricsChange}
                                        onStartReached={onStartReached}
                                        onStartReachedThreshold={onStartReachedThreshold}
                                        onStickyHeaderChange={onStickyHeaderChange}
                                        onViewableItemsChanged={onViewableItemsChanged}
                                        overrideItemLayout={overrideItemLayout}
                                        recycleItems={recycleItems}
                                        ref={(r: LegendListRef | null) => {
                                            if (r) layerRefs.current.set(ds.key, r);
                                            else layerRefs.current.delete(ds.key);
                                        }}
                                        registerLayer={registerLayer}
                                        renderItem={callbacks.renderItem}
                                        rtl={rtl}
                                        sharedAnimatedScrollY={sharedAnimatedScrollY}
                                        sharedRefScroller={sharedRefScroller}
                                        snapToIndices={snapToIndices}
                                        stickyHeaderConfig={stickyHeaderConfig}
                                        stickyHeaderIndices={stickyHeaderIndices}
                                        stickyIndices={stickyIndices}
                                        style={style}
                                        viewabilityConfig={viewabilityConfig}
                                        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
                                    />
                                </StateProvider>
                            </DatasetLayerShell>
                        );
                    })}
                </Animated.View>

                {ListFooterComponent && (
                    <LayoutView onLayoutChange={onLayoutFooterInternal} style={ListFooterComponentStyle}>
                        {getComponent(ListFooterComponent)}
                    </LayoutView>
                )}
            </ScrollComponent>
        );
    }),
);

// suppress unused-import warnings for things the linter might not see used through JSX
void IsNewArchitecture;
