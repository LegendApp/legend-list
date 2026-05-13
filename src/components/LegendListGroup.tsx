import * as React from "react";
import { type ForwardedRef, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";

import { LegendList } from "@/components/LegendList";
import { ListComponentScrollView } from "@/components/ListComponentScrollView";
import { useCombinedRef } from "@/hooks/useCombinedRef";
import { LayoutView } from "@/platform/LayoutView";
import type { LayoutRectangle, NativeScrollEvent, NativeSyntheticEvent } from "@/platform/platform-types";
import { RefreshControl } from "@/platform/RefreshControl";
import { StyleSheet } from "@/platform/StyleSheet";
import type { LooseScrollView, LooseScrollViewProps, ViewStyle } from "@/platform/scrollview-types";
import { View } from "@/platform/ViewComponents";
import { StateProvider, set$, useStateContext } from "@/state/state";
import type {
    LegendListGroupInactiveBehavior,
    LegendListGroupInactiveUpdateMode,
    LegendListGroupList,
    LegendListGroupPropsBase,
    LegendListRef,
} from "@/types.base";
import { typedForwardRef, typedMemo } from "@/types.internal";
import { getComponent } from "@/utils/getComponent";
import { normalizeMaintainVisibleContentPosition } from "@/utils/normalizeMaintainVisibleContentPosition";

type LayerRegistration = {
    onMomentumScrollEnd?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    snapToOffsets?: number[];
};

type GroupContextValue = {
    activeKey: string;
    footerSize: number;
    headerSize: number;
    horizontal: boolean;
    layout: LayoutRectangle | undefined;
    registerLayer: (key: string, registration: LayerRegistration) => () => void;
    sharedScrollerRef: React.RefObject<LooseScrollView | null>;
};

const GroupContext = React.createContext<GroupContextValue | null>(null);

const Activity = (React as any).Activity as
    | React.ComponentType<{ children: React.ReactNode; mode: "hidden" | "visible" }>
    | undefined;

function ActivityOrFragment({
    children,
    enabled,
    mode,
}: {
    children: React.ReactNode;
    enabled: boolean;
    mode: "hidden" | "visible";
}) {
    if (enabled && Activity) {
        return <Activity mode={mode}>{children}</Activity>;
    }
    return <>{children}</>;
}

function emptyLegendListState() {
    return {
        activeStickyIndex: -1,
        contentLength: 0,
        data: [],
        elementAtIndex: () => undefined,
        end: -1,
        endBuffered: -1,
        getAverageItemSizes: () => ({}),
        isAtEnd: false,
        isAtStart: true,
        isEndReached: false,
        isNearEnd: false,
        isNearStart: true,
        isStartReached: false,
        isWithinMaintainScrollAtEndThreshold: false,
        listen: () => () => {},
        listenToPosition: () => () => {},
        positionAtIndex: () => undefined as never,
        positionByKey: () => undefined,
        scroll: 0,
        scrollLength: 0,
        scrollVelocity: 0,
        sizeAtIndex: () => undefined as never,
        sizes: new Map(),
        start: -1,
        startBuffered: -1,
    };
}

function getScrollOffset(event: NativeSyntheticEvent<NativeScrollEvent>, horizontal: boolean) {
    return event.nativeEvent.contentOffset[horizontal ? "x" : "y"] ?? 0;
}

function isFiniteLayout(layout: LayoutRectangle | undefined) {
    return !!layout && Number.isFinite(layout.width) && Number.isFinite(layout.height);
}

function GroupLayerScrollComponent({ listKey, scrollProps }: { listKey: string; scrollProps: LooseScrollViewProps }) {
    const group = React.useContext(GroupContext);
    const ctx = useStateContext();
    const { children, onLayout, onMomentumScrollEnd, onScroll, ref, snapToOffsets } =
        scrollProps as any as LooseScrollViewProps & {
            children?: React.ReactNode;
            ref?: React.Ref<LooseScrollView | null>;
            snapToOffsets?: number[];
        };

    useImperativeHandle(ref, () => group?.sharedScrollerRef.current ?? null, [group]);

    useLayoutEffect(() => {
        if (!group) {
            return;
        }
        return group.registerLayer(listKey, {
            onMomentumScrollEnd: onMomentumScrollEnd as
                | ((event: NativeSyntheticEvent<NativeScrollEvent>) => void)
                | undefined,
            onScroll: onScroll as ((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined,
            snapToOffsets,
        });
    }, [group, listKey, onMomentumScrollEnd, onScroll, snapToOffsets]);

    useLayoutEffect(() => {
        if (!group) {
            return;
        }
        set$(ctx, "headerSize", group.headerSize);
    }, [ctx, group?.headerSize]);

    useLayoutEffect(() => {
        if (!group) {
            return;
        }
        set$(ctx, "footerSize", group.footerSize);
    }, [ctx, group?.footerSize]);

    useLayoutEffect(() => {
        if (!group || !isFiniteLayout(group.layout)) {
            return;
        }
        onLayout?.({
            nativeEvent: {
                layout: group.layout!,
            },
        } as any);
    }, [group?.layout, onLayout]);

    return <View style={group?.horizontal ? { height: "100%" } : undefined}>{children}</View>;
}

type GroupLayerProps<ItemT> = {
    inactiveBehavior: LegendListGroupInactiveBehavior;
    inactiveUpdateMode: LegendListGroupInactiveUpdateMode;
    isActive: boolean;
    list: LegendListGroupList<ItemT>;
    listRef: (ref: LegendListRef | null) => void;
    sharedProps: Omit<
        LegendListGroupPropsBase<ItemT, LooseScrollViewProps>,
        "activeKey" | "inactiveBehavior" | "inactiveUpdateMode" | "lists" | "scrollPositionMode"
    >;
};

function GroupLayer<ItemT>({
    inactiveBehavior,
    inactiveUpdateMode,
    isActive,
    list,
    listRef,
    sharedProps,
}: GroupLayerProps<ItemT>) {
    const [committedList, setCommittedList] = useState(list);
    const shouldUseLatest = isActive || inactiveUpdateMode === "eager";
    const effectiveList = shouldUseLatest ? list : committedList;

    useLayoutEffect(() => {
        if (shouldUseLatest) {
            setCommittedList(list);
        }
    }, [list, shouldUseLatest]);

    if (!isActive && inactiveBehavior === "unmount") {
        return null;
    }

    const {
        data,
        key: _key,
        ListFooterComponent: _ListFooterComponent,
        ListFooterComponentStyle: _ListFooterComponentStyle,
        ListHeaderComponent: _ListHeaderComponent,
        ListHeaderComponentStyle: _ListHeaderComponentStyle,
        numColumns: _numColumns,
        renderItem,
        ...listProps
    } = effectiveList as LegendListGroupList<ItemT> & {
        ListFooterComponent?: never;
        ListFooterComponentStyle?: never;
        ListHeaderComponent?: never;
        ListHeaderComponentStyle?: never;
        numColumns?: never;
    };
    const renderItemResolved = renderItem ?? sharedProps.renderItem;

    if (!renderItemResolved) {
        if (process.env.NODE_ENV !== "production") {
            console.warn(`[legend-list] LegendListGroup list "${list.key}" has no renderItem.`);
        }
        return null;
    }

    return (
        <View
            style={
                isActive
                    ? undefined
                    : ({
                          left: 0,
                          opacity: 0,
                          pointerEvents: "none",
                          position: "absolute",
                          right: 0,
                          top: 0,
                      } as ViewStyle)
            }
        >
            <ActivityOrFragment enabled={inactiveBehavior === "activity"} mode={isActive ? "visible" : "hidden"}>
                <LegendList
                    {...(sharedProps as any)}
                    {...(listProps as any)}
                    data={data}
                    ListFooterComponent={undefined}
                    ListHeaderComponent={undefined}
                    onLayout={undefined}
                    onRefresh={undefined}
                    ref={listRef as any}
                    refreshControl={undefined}
                    refreshing={undefined}
                    refScrollView={undefined}
                    renderItem={renderItemResolved as any}
                    renderScrollComponent={(scrollProps) => (
                        <GroupLayerScrollComponent
                            listKey={list.key}
                            scrollProps={scrollProps as LooseScrollViewProps}
                        />
                    )}
                />
            </ActivityOrFragment>
        </View>
    );
}

const LegendListGroupInner = typedForwardRef(function LegendListGroupInnerComponent<ItemT>(
    props: LegendListGroupPropsBase<ItemT, LooseScrollViewProps>,
    forwardedRef: ForwardedRef<LegendListRef>,
) {
    const {
        activeKey,
        contentContainerStyle: contentContainerStyleProp,
        horizontal = false,
        inactiveBehavior = "hidden",
        inactiveUpdateMode = "lazy",
        lists,
        ListFooterComponent,
        ListFooterComponentStyle,
        ListHeaderComponent,
        ListHeaderComponentStyle,
        onLayout: onLayoutProp,
        onMomentumScrollEnd,
        onRefresh,
        onScroll: onScrollProp,
        progressViewOffset,
        refScrollView,
        refreshing,
        refreshControl,
        renderScrollComponent,
        scrollEventThrottle,
        scrollPositionMode = "independent",
        style: styleProp,
        ...sharedProps
    } = props;

    const groupCtx = useStateContext();
    const sharedScrollerRef = useRef<LooseScrollView | null>(null);
    const combinedRef = useCombinedRef(sharedScrollerRef, refScrollView);
    const listRefs = useRef(new Map<string, LegendListRef | null>());
    const layerRegistrations = useRef(new Map<string, LayerRegistration>());
    const renderScrollComponentRef = useRef(renderScrollComponent);
    const savedOffsets = useRef(new Map<string, number>());
    const activeKeyRef = useRef(activeKey);
    const activeList = lists.find((list) => list.key === activeKey);
    const [layout, setLayout] = useState<LayoutRectangle | undefined>();
    const [headerSize, setHeaderSize] = useState(() => sharedProps.estimatedHeaderSize ?? 0);
    const [footerSize, setFooterSize] = useState(0);
    const [activeSnapToOffsets, setActiveSnapToOffsets] = useState<number[] | undefined>();

    activeKeyRef.current = activeKey;
    renderScrollComponentRef.current = renderScrollComponent;

    if (!groupCtx.state) {
        groupCtx.state = {
            props: {
                anchoredEndSpace: undefined,
                contentInsetEndAdjustment: (sharedProps as any).contentInsetEndAdjustment,
                horizontal: !!horizontal,
            },
            refScroller: sharedScrollerRef,
        } as any;
    }
    groupCtx.state.props.horizontal = !!horizontal;
    groupCtx.state.props.contentInsetEndAdjustment = (sharedProps as any).contentInsetEndAdjustment;
    groupCtx.state.refScroller = sharedScrollerRef as any;

    const setListRef = useCallback((key: string, ref: LegendListRef | null) => {
        if (ref) {
            listRefs.current.set(key, ref);
        } else {
            listRefs.current.delete(key);
        }
    }, []);

    const registerLayer = useCallback((key: string, registration: LayerRegistration) => {
        layerRegistrations.current.set(key, registration);
        if (key === activeKeyRef.current) {
            setActiveSnapToOffsets(registration.snapToOffsets);
        }
        return () => {
            if (layerRegistrations.current.get(key) === registration) {
                layerRegistrations.current.delete(key);
                if (key === activeKeyRef.current) {
                    setActiveSnapToOffsets(undefined);
                }
            }
        };
    }, []);

    useLayoutEffect(() => {
        setActiveSnapToOffsets(layerRegistrations.current.get(activeKey)?.snapToOffsets);
        if (scrollPositionMode !== "independent") {
            return;
        }
        const offset = savedOffsets.current.get(activeKey);
        if (offset !== undefined) {
            requestAnimationFrame(() => {
                sharedScrollerRef.current?.scrollTo({
                    animated: false,
                    x: horizontal ? offset : 0,
                    y: horizontal ? 0 : offset,
                });
            });
        }
    }, [activeKey, horizontal, scrollPositionMode]);

    const activeMaintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(
        activeList?.maintainVisibleContentPosition ?? sharedProps.maintainVisibleContentPosition,
    );

    const contextValue = useMemo<GroupContextValue>(
        () => ({
            activeKey,
            footerSize,
            headerSize,
            horizontal: !!horizontal,
            layout,
            registerLayer,
            sharedScrollerRef,
        }),
        [activeKey, footerSize, headerSize, horizontal, layout, registerLayer],
    );

    const onLayout = useCallback(
        (event: { nativeEvent: { layout: LayoutRectangle } }) => {
            setLayout(event.nativeEvent.layout);
            onLayoutProp?.(event as any);
        },
        [onLayoutProp],
    );

    const onScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const offset = getScrollOffset(event, !!horizontal);
            savedOffsets.current.set(activeKeyRef.current, offset);
            layerRegistrations.current.get(activeKeyRef.current)?.onScroll?.(event);
            onScrollProp?.(event as any);
        },
        [horizontal, onScrollProp],
    );

    const onMomentumScrollEndInternal = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            layerRegistrations.current.get(activeKeyRef.current)?.onMomentumScrollEnd?.(event);
            onMomentumScrollEnd?.(event as any);
        },
        [onMomentumScrollEnd],
    );

    useLayoutEffect(() => {
        if (ListHeaderComponent) {
            if (sharedProps.estimatedHeaderSize !== undefined) {
                setHeaderSize(sharedProps.estimatedHeaderSize);
            }
        } else {
            setHeaderSize(0);
        }
    }, [ListHeaderComponent, sharedProps.estimatedHeaderSize]);

    useLayoutEffect(() => {
        if (!ListFooterComponent) {
            setFooterSize(0);
        }
    }, [ListFooterComponent]);

    useImperativeHandle(forwardedRef, () => {
        const activeRef = () => listRefs.current.get(activeKeyRef.current);
        const nativeRef = () => sharedScrollerRef.current ?? activeRef()?.getNativeScrollRef();
        return {
            clearCaches: (options) => activeRef()?.clearCaches(options),
            flashScrollIndicators: () => nativeRef()?.flashScrollIndicators?.(),
            getNativeScrollRef: () => nativeRef(),
            getScrollableNode: () => nativeRef()?.getScrollableNode?.(),
            getScrollResponder: () => nativeRef()?.getScrollResponder?.(),
            getState: () => activeRef()?.getState() ?? emptyLegendListState(),
            reportContentInset: (inset) => activeRef()?.reportContentInset(inset),
            scrollIndexIntoView: (params) => activeRef()?.scrollIndexIntoView(params) ?? Promise.resolve(),
            scrollItemIntoView: (params) => activeRef()?.scrollItemIntoView(params) ?? Promise.resolve(),
            scrollToEnd: (options) => activeRef()?.scrollToEnd(options) ?? Promise.resolve(),
            scrollToIndex: (params) => activeRef()?.scrollToIndex(params) ?? Promise.resolve(),
            scrollToItem: (params) => activeRef()?.scrollToItem(params) ?? Promise.resolve(),
            scrollToOffset: (params) => activeRef()?.scrollToOffset(params) ?? Promise.resolve(),
            setScrollProcessingEnabled: (enabled) => activeRef()?.setScrollProcessingEnabled(enabled),
            setVisibleContentAnchorOffset: (value) => activeRef()?.setVisibleContentAnchorOffset(value),
        };
    }, []);

    const ScrollComponent = useMemo(
        () =>
            React.forwardRef((scrollProps: LooseScrollViewProps, ref) => {
                const render = renderScrollComponentRef.current;
                if (render) {
                    return render({ ...scrollProps, ref } as LooseScrollViewProps);
                }
                return React.createElement(ListComponentScrollView as React.ComponentType<any>, {
                    ...scrollProps,
                    ref,
                });
            }),
        [],
    );

    const refreshControlElement = refreshControl as React.ReactElement<{ progressViewOffset?: number }> | undefined;
    const contentContainerStyle = StyleSheet.flatten(contentContainerStyleProp) as ViewStyle | undefined;
    const style = StyleSheet.flatten(styleProp) as ViewStyle | undefined;

    return (
        <GroupContext.Provider value={contextValue}>
            <ScrollComponent
                {...(sharedProps as any)}
                contentContainerStyle={[
                    horizontal
                        ? {
                              height: "100%",
                          }
                        : {},
                    contentContainerStyle,
                ]}
                horizontal={!!horizontal}
                maintainVisibleContentPosition={
                    activeMaintainVisibleContentPosition.size || activeMaintainVisibleContentPosition.data
                        ? { minIndexForVisible: 0 }
                        : undefined
                }
                onLayout={onLayout as any}
                onMomentumScrollEnd={onMomentumScrollEndInternal as any}
                onScroll={onScroll as any}
                ref={combinedRef as any}
                refreshControl={
                    refreshControlElement ??
                    (onRefresh && <RefreshControl onRefresh={onRefresh} refreshing={!!refreshing} />)
                }
                scrollEventThrottle={scrollEventThrottle ?? 0}
                snapToOffsets={activeSnapToOffsets}
                style={style}
            >
                {ListHeaderComponent && (
                    <LayoutView
                        onLayoutChange={(rect) => setHeaderSize(rect[horizontal ? "width" : "height"])}
                        style={ListHeaderComponentStyle}
                    >
                        {getComponent(ListHeaderComponent)}
                    </LayoutView>
                )}
                {lists.map((list) => (
                    <GroupLayer
                        inactiveBehavior={inactiveBehavior}
                        inactiveUpdateMode={inactiveUpdateMode}
                        isActive={list.key === activeKey}
                        key={list.key}
                        list={list}
                        listRef={(ref) => setListRef(list.key, ref)}
                        sharedProps={
                            {
                                ...sharedProps,
                                contentContainerStyle: contentContainerStyleProp,
                                horizontal,
                                progressViewOffset,
                                renderItem: props.renderItem,
                                style: styleProp,
                            } as any
                        }
                    />
                ))}
                {ListFooterComponent && (
                    <LayoutView
                        onLayoutChange={(rect) => setFooterSize(rect[horizontal ? "width" : "height"])}
                        style={ListFooterComponentStyle}
                    >
                        {getComponent(ListFooterComponent)}
                    </LayoutView>
                )}
            </ScrollComponent>
        </GroupContext.Provider>
    );
});

export const LegendListGroup = typedMemo(
    typedForwardRef(function LegendListGroupComponent<ItemT>(
        props: LegendListGroupPropsBase<ItemT, LooseScrollViewProps>,
        forwardedRef: ForwardedRef<LegendListRef>,
    ) {
        return (
            <StateProvider>
                <LegendListGroupInner {...props} ref={forwardedRef} />
            </StateProvider>
        );
    }),
);
