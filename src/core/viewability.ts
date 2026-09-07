import { getIndexedData, type IndexedData } from "@/core/IndexedData";
import { getLayoutOffset, getLayoutSize, type LayoutAccess } from "@/core/layoutAccessors";
import type { LooseScrollViewProps } from "@/platform/scrollview-types";
import { peek$, type StateContext } from "@/state/state";
import type {
    ViewAmountToken,
    ViewabilityConfig,
    ViewabilityConfigCallbackPair,
    ViewabilityConfigCallbackPairs,
    ViewToken,
} from "@/types.base";
import type { InternalState, LegendListPropsBase } from "@/types.internal";
import { getId } from "@/utils/getId";
import { findContainerId } from "@/utils/helpers";

function ensureViewabilityState(
    ctx: StateContext,
    configId: string,
): {
    endBuffered: number;
    viewableItems: ViewToken[];
    start: number;
    startBuffered: number;
    end: number;
    previousStart: number;
    previousEnd: number;
} {
    // Lazily initialize the per-list map if absent (e.g., in tests with manual contexts)
    let map = ctx.mapViewabilityConfigStates;
    if (!map) {
        map = new Map();
        ctx.mapViewabilityConfigStates = map;
    }
    let state = map.get(configId);
    if (!state) {
        state = {
            end: -1,
            endBuffered: -1,
            previousEnd: -1,
            previousStart: -1,
            start: -1,
            startBuffered: -1,
            viewableItems: [],
        };
        map.set(configId, state);
    }
    return state;
}

export function setupViewability(
    props: Pick<
        LegendListPropsBase<any, LooseScrollViewProps>,
        "viewabilityConfig" | "viewabilityConfigCallbackPairs" | "onViewableItemsChanged"
    >,
): ViewabilityConfigCallbackPairs<any> {
    const { viewabilityConfig, viewabilityConfigCallbackPairs, onViewableItemsChanged } = props;
    const pairs = (viewabilityConfigCallbackPairs ?? []).map((pair, index) => {
        const normalizedConfig = normalizeViewabilityConfig(pair.viewabilityConfig, `pair-${index}`);
        return normalizedConfig === pair.viewabilityConfig ? pair : { ...pair, viewabilityConfig: normalizedConfig };
    });

    pairs.push({
        onViewableItemsChanged,
        viewabilityConfig: normalizeViewabilityConfig(viewabilityConfig, ""),
    });

    return pairs;
}

function normalizeViewabilityConfig(config: ViewabilityConfig | undefined, defaultId: string): ViewabilityConfig {
    const normalized = config ?? {};
    const hasThreshold =
        normalized.itemVisiblePercentThreshold !== undefined ||
        normalized.viewAreaCoveragePercentThreshold !== undefined;
    if (normalized.id !== undefined && hasThreshold) {
        return normalized;
    }

    return {
        ...normalized,
        id: normalized.id ?? defaultId,
        ...(hasThreshold ? undefined : { viewAreaCoveragePercentThreshold: 0 }),
    };
}

export function getViewabilityStartOffset(config: ViewabilityConfig | undefined) {
    const startOffset = config?.startOffset ?? 0;
    return Number.isFinite(startOffset) && startOffset > 0 ? startOffset : 0;
}

export function hasViewabilityConsumers(ctx: StateContext, pairs = ctx.state?.viewabilityConfigCallbackPairs): boolean {
    return (
        !!pairs?.some((pair) => !!pair.onViewableItemsChanged) ||
        (ctx.mapViewabilityCallbacks?.size ?? 0) > 0 ||
        (ctx.mapViewabilityAmountCallbacks?.size ?? 0) > 0
    );
}

export function requestViewabilityRecalculation(ctx: StateContext) {
    const state = ctx.state;
    if (state) {
        state.enableScrollForNextCalculateItemsInView = true;
        state.scrollForNextCalculateItemsInView = undefined;
        state.triggerCalculateItemsInView?.();
    }
}

export function updateViewableItems(
    ctx: StateContext,
    viewabilityConfigCallbackPairs: ViewabilityConfigCallbackPair<any>[],
    scrollSize: number,
    start: number,
    end: number,
    startBuffered = start,
    endBuffered = end,
    layout?: LayoutAccess,
) {
    const state = ctx.state;
    const indexedData = getIndexedData(state);
    for (let pairIndex = 0; pairIndex < viewabilityConfigCallbackPairs.length; pairIndex++) {
        const viewabilityConfigCallbackPair = viewabilityConfigCallbackPairs[pairIndex];
        const publishAmounts = pairIndex === viewabilityConfigCallbackPairs.length - 1;
        const viewabilityState = ensureViewabilityState(ctx, viewabilityConfigCallbackPair.viewabilityConfig.id!);
        viewabilityState.start = start;
        viewabilityState.end = end;
        viewabilityState.startBuffered = startBuffered;
        viewabilityState.endBuffered = endBuffered;
        if (viewabilityConfigCallbackPair.viewabilityConfig.minimumViewTime) {
            state.scheduledWork.timeout(() => {
                const currentPairs = state.viewabilityConfigCallbackPairs;
                if (
                    (!currentPairs || currentPairs.includes(viewabilityConfigCallbackPair)) &&
                    hasViewabilityConsumers(ctx, currentPairs ?? [viewabilityConfigCallbackPair])
                ) {
                    updateViewableItemsWithConfig(
                        indexedData,
                        viewabilityConfigCallbackPair,
                        state,
                        ctx,
                        scrollSize,
                        undefined,
                        publishAmounts,
                    );
                }
            }, viewabilityConfigCallbackPair.viewabilityConfig.minimumViewTime);
        } else {
            updateViewableItemsWithConfig(
                indexedData,
                viewabilityConfigCallbackPair,
                state,
                ctx,
                scrollSize,
                layout,
                publishAmounts,
            );
        }
    }
}

function updateViewableItemsWithConfig(
    data: IndexedData<any>,
    viewabilityConfigCallbackPair: ViewabilityConfigCallbackPair<any>,
    state: InternalState,
    ctx: StateContext,
    scrollSize: number,
    layout?: LayoutAccess,
    publishAmounts = false,
) {
    const { viewabilityConfig, onViewableItemsChanged } = viewabilityConfigCallbackPair;
    const configId = viewabilityConfig.id!;
    const viewabilityState = ensureViewabilityState(ctx, configId);
    const { viewableItems: previousViewableItems, start, end, startBuffered, endBuffered } = viewabilityState;

    let staleViewabilityAmountIds: number[] | undefined;
    for (const [containerId, value] of ctx.mapViewabilityAmountValues) {
        const nextValue = computeViewability(
            state,
            ctx,
            layout,
            viewabilityConfig,
            containerId,
            value.key,
            scrollSize,
            value.item,
            value.index,
            publishAmounts,
        );
        if (nextValue.sizeVisible < 0) {
            staleViewabilityAmountIds ??= [];
            staleViewabilityAmountIds.push(containerId);
        }
    }
    const changed: ViewToken[] = [];
    const previousViewableKeys = new Set<string>();
    if (previousViewableItems) {
        for (const viewToken of previousViewableItems) {
            previousViewableKeys.add(viewToken.key);
            const currentIndex = state.indexByKey.get(viewToken.key);
            const currentItem = currentIndex !== undefined ? data.getItem(currentIndex) : undefined;
            const containerId = findContainerId(ctx, viewToken.key);
            let isStillViewable = false;
            if (currentIndex !== undefined && (currentItem !== undefined || data.kind === "dataSource")) {
                isStillViewable = checkIsViewable(
                    state,
                    ctx,
                    layout,
                    viewabilityConfig,
                    containerId,
                    viewToken.key,
                    scrollSize,
                    currentItem,
                    currentIndex,
                    publishAmounts,
                );
            }
            if (!isStillViewable) {
                changed.push({
                    ...viewToken,
                    index: currentIndex ?? viewToken.index,
                    isViewable: false,
                    item: currentItem ?? viewToken.item,
                });
            }
        }
    }

    const viewableItems: ViewToken[] = [];

    for (let i = start; i <= end; i++) {
        const item = data.getItem(i);
        if (item !== undefined || data.kind === "dataSource") {
            const key = getId(state, i);
            const containerId = findContainerId(ctx, key);
            if (
                checkIsViewable(
                    state,
                    ctx,
                    layout,
                    viewabilityConfig,
                    containerId,
                    key,
                    scrollSize,
                    item,
                    i,
                    publishAmounts,
                )
            ) {
                const viewToken: ViewToken = {
                    containerId,
                    index: i,
                    isViewable: true,
                    item,
                    key,
                };
                viewableItems.push(viewToken);
                if (!previousViewableKeys.has(viewToken.key)) {
                    changed.push(viewToken);
                }
            }
        }
    }

    Object.assign(viewabilityState, {
        previousEnd: end,
        previousStart: start,
        viewableItems,
    });

    if (changed.length > 0) {
        viewabilityState.viewableItems = viewableItems;

        for (let i = 0; i < changed.length; i++) {
            const change = changed[i];
            maybeUpdateViewabilityCallback(ctx, configId, change.containerId, change);
        }

        if (onViewableItemsChanged) {
            onViewableItemsChanged({ changed, end, endBuffered, start, startBuffered, viewableItems });
        }
    }

    if (staleViewabilityAmountIds) {
        for (const containerId of staleViewabilityAmountIds) {
            const value = ctx.mapViewabilityAmountValues.get(containerId);
            if (value && value.sizeVisible < 0) {
                ctx.mapViewabilityAmountValues.delete(containerId);
            }
        }
    }
}

function areViewabilityAmountTokensEqual(prev: ViewAmountToken | undefined, next: ViewAmountToken): boolean {
    return (
        !!prev &&
        prev.containerId === next.containerId &&
        prev.index === next.index &&
        prev.isViewable === next.isViewable &&
        prev.item === next.item &&
        prev.key === next.key &&
        prev.percentOfScroller === next.percentOfScroller &&
        prev.percentVisible === next.percentVisible &&
        prev.scrollSize === next.scrollSize &&
        prev.size === next.size &&
        prev.sizeVisible === next.sizeVisible
    );
}

function computeViewability(
    state: InternalState,
    ctx: StateContext,
    layout: LayoutAccess | undefined,
    viewabilityConfig: ViewabilityConfig,
    containerId: number,
    key: string,
    scrollSize: number,
    item: any,
    index: number,
    publishAmount: boolean,
): ViewAmountToken {
    const { scroll: scrollState } = state;
    const topPad =
        (peek$(ctx, "stylePaddingTop") || 0) +
        (peek$(ctx, "alignItemsAtEndPadding") || 0) +
        (peek$(ctx, "headerSize") || 0);
    const { itemVisiblePercentThreshold, viewAreaCoveragePercentThreshold } = viewabilityConfig;
    const viewAreaMode = viewAreaCoveragePercentThreshold != null;
    const viewablePercentThreshold = viewAreaMode ? viewAreaCoveragePercentThreshold : itemVisiblePercentThreshold;
    const startOffset = getViewabilityStartOffset(viewabilityConfig);
    const effectiveScrollSize = Math.max(0, scrollSize - startOffset);
    const scroll = scrollState - topPad + startOffset;
    const position = layout ? layout.getOffset(index) : getLayoutOffset(ctx, index);
    const size = (layout ? layout.getSize(index) : getLayoutSize(ctx, index)) ?? 0;

    if (position === undefined) {
        const value: ViewAmountToken = {
            containerId,
            index,
            isViewable: false,
            item,
            key,
            percentOfScroller: 0,
            percentVisible: 0,
            scrollSize: effectiveScrollSize,
            size,
            sizeVisible: -1,
        };

        if (publishAmount) {
            publishViewabilityAmount(ctx, value);
        }
        return value;
    }

    const top = position - scroll;
    const bottom = top + size;
    const isEntirelyVisible = top >= 0 && bottom <= effectiveScrollSize && bottom > top;

    const sizeVisible = isEntirelyVisible ? size : Math.min(bottom, effectiveScrollSize) - Math.max(top, 0);
    const percentVisible = size ? (isEntirelyVisible ? 100 : 100 * (sizeVisible / size)) : 0;
    const percentOfScroller = effectiveScrollSize > 0 ? 100 * (sizeVisible / effectiveScrollSize) : 0;
    const percent = isEntirelyVisible ? 100 : viewAreaMode ? percentOfScroller : percentVisible;

    const isViewable = sizeVisible > 0 && percent >= (viewablePercentThreshold ?? 0);

    const value: ViewAmountToken = {
        containerId,
        index,
        isViewable,
        item,
        key,
        percentOfScroller,
        percentVisible,
        scrollSize: effectiveScrollSize,
        size,
        sizeVisible,
    };

    if (publishAmount) {
        publishViewabilityAmount(ctx, value);
    }

    return value;
}

function publishViewabilityAmount(ctx: StateContext, value: ViewAmountToken) {
    const prev = ctx.mapViewabilityAmountValues.get(value.containerId);
    if (!areViewabilityAmountTokensEqual(prev, value)) {
        ctx.mapViewabilityAmountValues.set(value.containerId, value);
        ctx.mapViewabilityAmountCallbacks.get(value.containerId)?.(value);
    }
}

function checkIsViewable(
    state: InternalState,
    ctx: StateContext,
    layout: LayoutAccess | undefined,
    viewabilityConfig: ViewabilityConfig,
    containerId: number,
    key: string,
    scrollSize: number,
    item: any,
    index: number,
    publishAmount: boolean,
) {
    const value = computeViewability(
        state,
        ctx,
        layout,
        viewabilityConfig,
        containerId,
        key,
        scrollSize,
        item,
        index,
        publishAmount,
    );

    return value.isViewable;
}

function maybeUpdateViewabilityCallback(
    ctx: StateContext,
    configId: string,
    containerId: number,
    viewToken: ViewToken,
) {
    const key = containerId + configId;

    ctx.mapViewabilityValues.set(key, viewToken);

    const cb = ctx.mapViewabilityCallbacks.get(key);
    cb?.(viewToken);
}
