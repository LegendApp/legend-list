import * as React from "react";
import { type ForwardedRef, useCallback, useImperativeHandle, useMemo, useRef } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

import {
    LegendList,
    type LegendListProps,
    type LegendListRef,
    type LegendListRenderItemProps,
    type OnViewableItemsChanged,
    type OnViewableItemsChangedInfo,
    type ViewabilityConfigCallbackPairs,
    type ViewToken,
} from "@legendapp/list/react-native";

const INFINITE_KEY_SEPARATOR = "␟";

export interface InfiniteModeConfig {
    /**
     * How many times the data is repeated to create the virtual scroll space.
     * Odd values keep a well-defined center copy. Defaults to at least 9 copies,
     * scaled up automatically for very short datasets.
     */
    copies?: number;
}

interface InfiniteModeProps<T> {
    data: ReadonlyArray<T>;
    renderItem: (props: LegendListRenderItemProps<T, any> & { infiniteIndex: number }) => React.ReactNode;
    keyExtractor?: (item: T, index: number) => string;
    getItemType?: (item: T, index: number) => any;
    getFixedItemSize?: (item: T, index: number, type: any) => number | undefined;
    overrideItemLayout?: (
        layout: { span?: number },
        item: T,
        index: number,
        maxColumns: number,
        extraData?: any,
    ) => void;
    horizontal?: boolean;
    initialScrollIndex?: number | { index: number; viewOffset?: number; viewPosition?: number };
    onEndReached?: unknown;
    onStartReached?: unknown;
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onMomentumScrollEnd?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onViewableItemsChanged?: OnViewableItemsChanged<T> | undefined;
    viewabilityConfigCallbackPairs?: ViewabilityConfigCallbackPairs<T>;
    onFirstVisibleItemChanged?: (info: { index: number; item: T; key: string }) => void;
}

function resolveCopies(infiniteMode: boolean | InfiniteModeConfig, dataLength: number): number {
    const configured = typeof infiniteMode === "object" ? infiniteMode.copies : undefined;
    let copies = configured ?? Math.max(9, Math.ceil(40 / dataLength));
    copies = Math.max(3, copies);
    if (copies % 2 === 0) {
        copies++;
    }
    return copies;
}

export function useInfiniteMode<T, TProps extends InfiniteModeProps<T>>(
    props: TProps,
    infiniteMode: boolean | InfiniteModeConfig | undefined,
    forwardedRef: ForwardedRef<LegendListRef>,
): { props: TProps; refTarget: React.RefObject<LegendListRef | null> } {
    const {
        data,
        renderItem,
        keyExtractor,
        getItemType,
        getFixedItemSize,
        overrideItemLayout,
        horizontal,
        initialScrollIndex: initialScrollIndexProp,
        onScroll: onScrollProp,
        onMomentumScrollEnd: onMomentumScrollEndProp,
        onViewableItemsChanged,
        viewabilityConfigCallbackPairs,
        onFirstVisibleItemChanged,
    } = props;

    const dataLength = data.length;
    const enabled = !!infiniteMode && dataLength > 0;
    const copies = enabled ? resolveCopies(infiniteMode!, dataLength) : 1;
    const middleCopyBase = Math.floor(copies / 2) * dataLength;

    const refInner = useRef<LegendListRef | null>(null);

    const virtualData = useMemo(() => {
        if (!enabled) {
            return data;
        }
        const totalLength = dataLength * copies;
        const virtual = new Array<T>(totalLength);
        for (let i = 0; i < totalLength; i++) {
            virtual[i] = data[i % dataLength];
        }
        return virtual;
    }, [enabled, data, dataLength, copies]);

    const getCycleSize = useCallback((): number => {
        const inner = refInner.current;
        if (!inner) {
            return 0;
        }
        const state = inner.getState();
        const measured = state.positionAtIndex(dataLength) - state.positionAtIndex(0);
        if (Number.isFinite(measured) && measured > 0) {
            return measured;
        }
        return state.contentLength > 0 ? state.contentLength / copies : 0;
    }, [dataLength, copies]);

    const recenter = useCallback(
        (thresholdCycles: number) => {
            const inner = refInner.current;
            if (!inner) {
                return;
            }
            const state = inner.getState();
            const cycle = getCycleSize();
            if (!cycle || state.scrollLength <= 0 || state.contentLength <= state.scrollLength) {
                return;
            }
            const center = (state.contentLength - state.scrollLength) / 2;
            const drift = state.scroll - center;
            if (Math.abs(drift) < cycle * thresholdCycles) {
                return;
            }
            const cyclesToTeleport = Math.round(drift / cycle);
            if (cyclesToTeleport !== 0) {
                inner.scrollToOffset({ animated: false, offset: state.scroll - cyclesToTeleport * cycle });
            }
        },
        [getCycleSize],
    );

    const recenterThreshold = Math.max(1, Math.floor(copies / 4));

    const wrappedOnMomentumScrollEnd = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            recenter(recenterThreshold);
            onMomentumScrollEndProp?.(event);
        },
        [onMomentumScrollEndProp, recenter, recenterThreshold],
    );

    const wrappedOnScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            const offset = horizontal ? contentOffset.x : contentOffset.y;
            const total = horizontal ? contentSize.width : contentSize.height;
            const viewport = horizontal ? layoutMeasurement.width : layoutMeasurement.height;
            const approxCycle = total / copies;
            if (total > 0 && (offset < approxCycle || offset > total - viewport - approxCycle)) {
                recenter(1);
            }
            onScrollProp?.(event);
        },
        [copies, horizontal, onScrollProp, recenter],
    );

    const wrappedRenderItem = useCallback(
        (itemProps: LegendListRenderItemProps<T, any>) => {
            const virtualIndex = itemProps.index;
            return renderItem({
                ...itemProps,
                data,
                index: virtualIndex % dataLength,
                infiniteIndex: virtualIndex,
            });
        },
        [renderItem, data, dataLength],
    );

    const wrappedKeyExtractor = useCallback(
        (item: T, virtualIndex: number) => {
            const realIndex = virtualIndex % dataLength;
            const baseKey = keyExtractor ? keyExtractor(item, realIndex) : realIndex.toString();
            return `${baseKey}${INFINITE_KEY_SEPARATOR}${Math.floor(virtualIndex / dataLength)}`;
        },
        [keyExtractor, dataLength],
    );

    const wrappedGetItemType = useMemo(
        () =>
            getItemType ? (item: T, virtualIndex: number) => getItemType(item, virtualIndex % dataLength) : undefined,
        [getItemType, dataLength],
    );

    const wrappedGetFixedItemSize = useMemo(
        () =>
            getFixedItemSize
                ? (item: T, virtualIndex: number, type: any) => getFixedItemSize(item, virtualIndex % dataLength, type)
                : undefined,
        [getFixedItemSize, dataLength],
    );

    const wrappedOverrideItemLayout = useMemo(
        () =>
            overrideItemLayout
                ? (layout: { span?: number }, item: T, virtualIndex: number, maxColumns: number, extraData?: any) =>
                    overrideItemLayout(layout, item, virtualIndex % dataLength, maxColumns, extraData)
                : undefined,
        [overrideItemLayout, dataLength],
    );

    const mapViewToken = useCallback(
        (token: ViewToken<T>): ViewToken<T> => {
            const separatorIndex = token.key?.lastIndexOf(INFINITE_KEY_SEPARATOR) ?? -1;
            return {
                ...token,
                index: token.index != null && token.index >= 0 ? token.index % dataLength : token.index,
                key: separatorIndex >= 0 ? token.key.slice(0, separatorIndex) : token.key,
            };
        },
        [dataLength],
    );

    const mapViewabilityInfo = useCallback(
        (info: OnViewableItemsChangedInfo<T>): OnViewableItemsChangedInfo<T> => ({
            ...info,
            changed: info.changed.map(mapViewToken),
            end: info.end >= 0 ? info.end % dataLength : info.end,
            endBuffered: info.endBuffered >= 0 ? info.endBuffered % dataLength : info.endBuffered,
            start: info.start >= 0 ? info.start % dataLength : info.start,
            startBuffered: info.startBuffered >= 0 ? info.startBuffered % dataLength : info.startBuffered,
            viewableItems: info.viewableItems.map(mapViewToken),
        }),
        [mapViewToken, dataLength],
    );

    const wrappedOnViewableItemsChanged = useMemo(
        () =>
            onViewableItemsChanged
                ? (info: OnViewableItemsChangedInfo<T>) => onViewableItemsChanged(mapViewabilityInfo(info))
                : undefined,
        [onViewableItemsChanged, mapViewabilityInfo],
    );

    const wrappedViewabilityConfigCallbackPairs = useMemo(
        () =>
            viewabilityConfigCallbackPairs?.map((pair) => ({
                ...pair,
                onViewableItemsChanged: pair.onViewableItemsChanged
                    ? (info: OnViewableItemsChangedInfo<T>) => pair.onViewableItemsChanged!(mapViewabilityInfo(info))
                    : pair.onViewableItemsChanged,
            })) as ViewabilityConfigCallbackPairs<T> | undefined,
        [viewabilityConfigCallbackPairs, mapViewabilityInfo],
    );

    const wrappedOnFirstVisibleItemChanged = useMemo(
        () =>
            onFirstVisibleItemChanged
                ? (info: { index: number; item: T; key: string }) => {
                    const separatorIndex = info.key?.lastIndexOf(INFINITE_KEY_SEPARATOR) ?? -1;
                    onFirstVisibleItemChanged({
                        index: info.index % dataLength,
                        item: info.item,
                        key: separatorIndex >= 0 ? info.key.slice(0, separatorIndex) : info.key,
                    });
                }
                : undefined,
        [onFirstVisibleItemChanged, dataLength],
    );

    const initialScrollIndex = useMemo(() => {
        if (!enabled) {
            return initialScrollIndexProp;
        }
        if (initialScrollIndexProp == null) {
            return middleCopyBase;
        }
        if (typeof initialScrollIndexProp === "object") {
            return { ...initialScrollIndexProp, index: middleCopyBase + (initialScrollIndexProp.index ?? 0) };
        }
        return middleCopyBase + initialScrollIndexProp;
    }, [enabled, initialScrollIndexProp, middleCopyBase]);

    const toNearestVirtualIndex = useCallback(
        (realIndex: number) => {
            const normalizedTarget = ((realIndex % dataLength) + dataLength) % dataLength;
            const state = refInner.current?.getState();
            const currentVirtual =
                state && state.start >= 0 ? Math.round((state.start + state.end) / 2) : middleCopyBase;
            const currentReal = ((currentVirtual % dataLength) + dataLength) % dataLength;
            let diff = normalizedTarget - currentReal;
            if (Math.abs(diff) > dataLength / 2) {
                diff += diff > 0 ? -dataLength : dataLength;
            }
            return currentVirtual + diff;
        },
        [dataLength, middleCopyBase],
    );

    useImperativeHandle(forwardedRef, () => {
        const inner = refInner.current!;
        if (!enabled) {
            return inner;
        }
        const wrapped: LegendListRef = {
            ...inner,
            scrollIndexIntoView: (params) =>
                inner.scrollIndexIntoView({ ...params, index: toNearestVirtualIndex(params.index) }),
            scrollItemIntoView: ({ item, ...rest }) => {
                const index = data.indexOf(item as T);
                return index >= 0
                    ? inner.scrollIndexIntoView({ ...rest, index: toNearestVirtualIndex(index) })
                    : Promise.resolve();
            },
            scrollToIndex: (params) => inner.scrollToIndex({ ...params, index: toNearestVirtualIndex(params.index) }),
            scrollToItem: ({ item, ...rest }) => {
                const index = data.indexOf(item as T);
                return index >= 0
                    ? inner.scrollToIndex({ ...rest, index: toNearestVirtualIndex(index) })
                    : Promise.resolve();
            },
        };
        return wrapped;
    }, [enabled, data, toNearestVirtualIndex]);

    const transformedProps = enabled
        ? {
            ...props,
            data: virtualData,
            getFixedItemSize: wrappedGetFixedItemSize,
            getItemType: wrappedGetItemType,
            initialScrollIndex,
            keyExtractor: wrappedKeyExtractor,
            onEndReached: undefined,
            onFirstVisibleItemChanged: wrappedOnFirstVisibleItemChanged,
            onMomentumScrollEnd: wrappedOnMomentumScrollEnd,
            onScroll: wrappedOnScroll,
            onStartReached: undefined,
            onViewableItemsChanged: wrappedOnViewableItemsChanged,
            overrideItemLayout: wrappedOverrideItemLayout,
            renderItem: wrappedRenderItem,
            viewabilityConfigCallbackPairs: wrappedViewabilityConfigCallbackPairs,
        }
        : props;

    return { props: transformedProps as TProps, refTarget: refInner };
}

type UnsupportedInfiniteProps =
    | "alignItemsAtEnd"
    | "anchoredEndSpace"
    | "children"
    | "columnWrapperStyle"
    | "initialScrollAtEnd"
    | "ListFooterComponent"
    | "ListFooterComponentStyle"
    | "ListHeaderComponent"
    | "ListHeaderComponentStyle"
    | "maintainScrollAtEnd"
    | "maintainScrollAtEndThreshold"
    | "numColumns"
    | "onEndReached"
    | "onEndReachedThreshold"
    | "onStartReached"
    | "onStartReachedThreshold"
    | "stickyHeaderConfig"
    | "stickyHeaderIndices";

export interface InfiniteLegendListRenderItemProps<ItemT> extends LegendListRenderItemProps<ItemT> {
    /**
     * The item's index in the virtual (repeated) scroll space. Combine with the scroll offset
     * to drive carousel progress animations; `index` stays the index in the real data array.
     */
    infiniteIndex: number;
}

type PropsOf<TComponent> = TComponent extends React.ComponentType<infer TProps> ? TProps : never;

export type InfiniteLegendListProps<ItemT, TList extends React.ComponentType<any> = typeof LegendList> = Omit<
    LegendListProps<ItemT>,
    UnsupportedInfiniteProps | "data" | "renderItem"
> & {
    data: ReadonlyArray<ItemT>;

    renderItem: (props: InfiniteLegendListRenderItemProps<ItemT>) => React.ReactNode;

    /**
     * How many times the data is repeated to create the virtual scroll space.
     * Odd values keep a well-defined center copy. Defaults to at least 9 copies,
     * scaled up automatically for very short datasets.
     */
    copies?: number;

    /**
     * The underlying list component to render. Defaults to LegendList.
     * Pass AnimatedLegendList from `@legendapp/list/reanimated` to get a UI-thread
     * scroll offset shared value for progress animations, or the RN Animated variant
     * from `@legendapp/list/animated`.
     */
    ListComponent?: TList;
} & Omit<PropsOf<TList>, keyof LegendListProps<ItemT> | "ListComponent" | "copies">;

/**
 * A circular, endlessly-scrollable list — LegendList preconfigured as an infinite carousel.
 *
 * The data loops in both directions, scroll recentering is invisible, `renderItem` receives
 * real data indices plus a required `infiniteIndex`, and ref scroll methods wrap around via
 * the shortest path.
 */
// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const InfiniteLegendList = React.forwardRef(function InfiniteLegendList(
    props: { copies?: number; ListComponent?: React.ComponentType<any> } & Record<string, unknown>,
    ref: React.Ref<LegendListRef>,
) {
    const { copies, ListComponent = LegendList as React.ComponentType<any>, ...rest } = props;
    const infiniteMode = useMemo(() => (copies !== undefined ? { copies } : true), [copies]);
    const { props: transformedProps, refTarget } = useInfiniteMode(
        rest as unknown as InfiniteModeProps<unknown>,
        infiniteMode,
        ref,
    );

    return <ListComponent {...transformedProps} ref={refTarget} />;
}) as unknown as <ItemT, TList extends React.ComponentType<any> = typeof LegendList>(
    props: InfiniteLegendListProps<ItemT, TList> & { ref?: React.Ref<LegendListRef> },
) => React.ReactElement | null;
