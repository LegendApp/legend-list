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
//           │     │     └── <Activity mode> → <DatasetLayerInner /> (absolute)
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
import { LayoutView } from "@/platform/LayoutView";
import { Platform } from "@/platform/Platform";
import { RefreshControl } from "@/platform/RefreshControl";
import { StyleSheet } from "@/platform/StyleSheet";
import type {
    LayoutRectangle,
    LooseScrollView,
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
import { useThrottledOnScroll } from "@/utils/throttledOnScroll";

// React 19.2+ stable Activity with display fallback for older React.
const ReactActivity = (React as any).Activity as
    | React.ComponentType<{ mode: "visible" | "hidden"; children: React.ReactNode }>
    | undefined;
const Activity: React.ComponentType<{ mode: "visible" | "hidden"; children: React.ReactNode }> =
    ReactActivity ?? (({ children }) => <>{children}</>);

interface DatasetLayerShellProps {
    children: React.ReactNode;
    inactiveBehavior: DatasetInactiveBehavior;
    isActive: boolean;
}

function DatasetLayerShell({ children, inactiveBehavior, isActive }: DatasetLayerShellProps) {
    const shouldPause = !!ReactActivity && !isActive && inactiveBehavior === "pause";
    const shouldHide = !isActive && (inactiveBehavior === "hide" || (!ReactActivity && inactiveBehavior === "pause"));

    return (
        <View pointerEvents={isActive ? "auto" : "none"} style={styles.layerRoot}>
            <Activity mode={shouldPause ? "hidden" : "visible"}>
                <View style={shouldHide ? styles.layerHidden : styles.layerVisible}>{children}</View>
            </Activity>
        </View>
    );
}

export type DatasetInactiveBehavior = "pause" | "hide" | "unmount";

export interface LegendListDataset<T> {
    key: string;
    data: ReadonlyArray<T>;
    renderItem: (props: LegendListRenderItemProps<T, string | undefined>) => React.ReactNode;
    keyExtractor?: (item: T, index: number) => string;
    getItemType?: (item: T, index: number) => string | undefined;
    estimatedItemSize?: number;
}

export interface LegendListDatasetsProps<T>
    extends Omit<
        LegendListPropsBase<T, LooseScrollViewProps>,
        "data" | "renderItem" | "keyExtractor" | "getItemType" | "children"
    > {
    datasets: ReadonlyArray<LegendListDataset<T>>;
    activeKey: string;
    inactiveBehavior?: DatasetInactiveBehavior;
    /** Delay (ms) before mounting non-active datasets on first paint. Default 100. */
    staggerMountMs?: number;
}

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
            alignItemsAtEnd = false,
            datasets,
            activeKey,
            inactiveBehavior = "pause",
            staggerMountMs = 100,
            ListHeaderComponent,
            ListHeaderComponentStyle,
            ListFooterComponent,
            ListFooterComponentStyle,
            ListEmptyComponent,
            onScroll: onScrollProp,
            onMomentumScrollEnd,
            onLayout: onLayoutProp,
            onRefresh,
            refreshControl,
            refreshing,
            refScrollView,
            renderScrollComponent,
            scrollEventThrottle,
            style: styleProp,
            contentContainerStyle: contentContainerStyleProp,
            progressViewOffset,
            horizontal,
            ...rest
        } = props;

        // Shared resources.
        const sharedAnimatedScrollY = useRef(new Animated.Value(0)).current;
        const sharedRefScroller = useRef<LegendListScrollerRef | null>(null);
        const refScroller = useRef<LooseScrollView>(null);
        const combinedRef = useCombinedRef(refScroller, sharedRefScroller as any, refScrollView);
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

        const activeDataset = datasets.find((d) => d.key === activeKey);

        // Track which dataset keys are mounted (active + staggered others).
        const [mountedKeys, setMountedKeys] = useState<Set<string>>(() => new Set([activeKey]));
        const everActiveRef = useRef<Set<string>>(new Set([activeKey]));
        if (!everActiveRef.current.has(activeKey)) {
            everActiveRef.current.add(activeKey);
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
        }, [staggerMountMs, datasets.map((d) => d.key).join(",")]);

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

            const currentOffset = (refScroller.current as any)?.getCurrentScrollOffset?.();
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

                if (key === activeKey) {
                    syncLayerToCurrentScroll(layer);
                }
            }
        }, [activeKey, applyFooterSizeToLayer, applyLayoutToLayer, layerVersion, syncLayerToCurrentScroll]);

        // Sync ContentArea height to active layer's totalSize.
        useEffect(() => {
            const activeLayer = layersRef.current.get(activeKey);
            if (!activeLayer) return;
            const sync = () => {
                const v = peek$(activeLayer.ctx, "totalSize") || 0;
                sharedContentHeight.setValue(v);
            };
            sync();
            return listen$(activeLayer.ctx, "totalSize", sync);
        }, [activeKey, layerVersion, sharedContentHeight]);

        // Bootstrap initial scroll once, using the ACTIVE layer's intent (if any).
        const didBootstrapRef = useRef(false);
        useEffect(() => {
            if (didBootstrapRef.current) return;
            const activeLayer = layersRef.current.get(activeKey);
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
        }, [activeKey, layerVersion, ListFooterComponent]);

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
            ref: refScroller as unknown as React.RefObject<LooseView | null>,
        });

        // Scroll routing: only update the active layer's ctx.scroll.
        const baseOnScroll = useCallback(
            (event: NativeSyntheticEvent<NativeScrollEvent>) => {
                latestScrollEventRef.current = event;
                const activeLayer = layersRef.current.get(activeKey);
                if (activeLayer) {
                    routeOnScroll(activeLayer.ctx, event);
                }
            },
            [activeKey],
        );
        const noopOnScroll = useCallback((_event: NativeSyntheticEvent<NativeScrollEvent>) => {}, []);
        const throttledOnScroll = useThrottledOnScroll(onScrollProp ?? noopOnScroll, scrollEventThrottle ?? 0);
        const propScroll = scrollEventThrottle && onScrollProp ? throttledOnScroll : onScrollProp;

        const onScrollHandler = useCallback(
            (event: NativeSyntheticEvent<NativeScrollEvent>) => {
                baseOnScroll(event);
                propScroll?.(event);
            },
            [baseOnScroll, propScroll],
        );

        const onMomentumScrollEndHandler = useCallback(
            (event: NativeSyntheticEvent<NativeScrollEvent>) => {
                const activeLayer = layersRef.current.get(activeKey);
                if (activeLayer) {
                    checkFinishedScrollFallback(activeLayer.ctx);
                }
                onMomentumScrollEnd?.(event as any);
            },
            [activeKey, onMomentumScrollEnd],
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
        useImperativeHandle(
            forwardedRef,
            () =>
                new Proxy({} as LegendListRef, {
                    get: (_t, prop) => {
                        const target = layerRefs.current.get(activeKey);
                        const value = target ? (target as any)[prop] : undefined;
                        return typeof value === "function" ? value.bind(target) : value;
                    },
                }),
            [activeKey],
        );

        // Padding (for refresh control offset) — same derivation as LegendListInner.
        const style = { ...StyleSheet.flatten(styleProp) };
        const contentContainerStyleBase = StyleSheet.flatten(contentContainerStyleProp) as ViewStyle | undefined;
        const shouldFlexGrow =
            alignItemsAtEnd &&
            (horizontal ? contentContainerStyleBase?.minWidth == null : contentContainerStyleBase?.minHeight == null);
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
        const stylePaddingTopState = extractPadding(style as any, contentContainerStyle as any, "Top");

        const refreshControlElement = refreshControl as React.ReactElement<{ progressViewOffset?: number }> | undefined;
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
            return React.forwardRef((p: LooseScrollViewProps, ref) =>
                renderScrollComponent({ ...p, ref } as LooseScrollViewProps),
            );
        }, [renderScrollComponent]);

        const contentAreaStyle: Animated.WithAnimatedValue<ViewStyle> = horizontal
            ? { height: "100%", width: sharedContentHeight }
            : { height: sharedContentHeight, width: "100%" };

        const restScrollProps = rest as any;

        return (
            <ScrollComponent
                {...restScrollProps}
                contentContainerStyle={contentContainerStyle as any}
                horizontal={horizontal}
                onLayout={onLayout}
                onMomentumScrollEnd={onMomentumScrollEndHandler}
                onScroll={onScrollHandler}
                ref={combinedRef as any}
                refreshControl={resolvedRefreshControl}
                scrollEventThrottle={scrollEventThrottle ?? 0}
                style={style}
            >
                {ListHeaderComponent && (
                    <LayoutView onLayoutChange={onLayoutHeader} style={ListHeaderComponentStyle}>
                        {getComponent(ListHeaderComponent)}
                    </LayoutView>
                )}

                {ListEmptyComponent && activeDataset?.data.length === 0 && getComponent(ListEmptyComponent)}

                <Animated.View style={contentAreaStyle}>
                    {datasets.map((ds) => {
                        const isActive = ds.key === activeKey;
                        const shouldRender =
                            inactiveBehavior === "unmount"
                                ? isActive
                                : mountedKeys.has(ds.key) || everActiveRef.current.has(ds.key) || isActive;

                        if (!shouldRender) return null;

                        return (
                            <DatasetLayerShell inactiveBehavior={inactiveBehavior} isActive={isActive} key={ds.key}>
                                <StateProvider>
                                    <DatasetLayerInner
                                        {...(rest as any)}
                                        alignItemsAtEnd={alignItemsAtEnd}
                                        contentContainerStyle={contentContainerStyle}
                                        data={ds.data as T[]}
                                        estimatedItemSize={ds.estimatedItemSize ?? (rest as any).estimatedItemSize}
                                        getItemType={ds.getItemType}
                                        horizontal={horizontal}
                                        isActive={isActive}
                                        keyExtractor={ds.keyExtractor}
                                        layerKey={ds.key}
                                        recycleItems={restScrollProps.recycleItems}
                                        ref={(r: LegendListRef | null) => {
                                            if (r) layerRefs.current.set(ds.key, r);
                                            else layerRefs.current.delete(ds.key);
                                        }}
                                        registerLayer={registerLayer}
                                        renderItem={ds.renderItem}
                                        sharedAnimatedScrollY={sharedAnimatedScrollY}
                                        sharedRefScroller={
                                            sharedRefScroller as React.RefObject<LegendListScrollerRef | null>
                                        }
                                        style={style}
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
