import { peek$, type StateContext } from "@/state/state";
import type {
    InternalState,
    LegendListProps,
    ViewAmountToken,
    ViewabilityConfig,
    ViewabilityConfigCallbackPair,
    ViewabilityConfigCallbackPairs,
    ViewToken,
} from "@/types";
import { getId } from "@/utils/getId";
import { findContainerId } from "@/utils/helpers";

function ensureViewabilityState(
    ctx: StateContext,
    configId: string,
): {
    viewableItems: ViewToken[];
    start: number;
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
        state = { end: -1, previousEnd: -1, previousStart: -1, start: -1, viewableItems: [] };
        map.set(configId, state);
    }
    return state;
}

export function setupViewability(
    props: Pick<
        LegendListProps<any>,
        "viewabilityConfig" | "viewabilityConfigCallbackPairs" | "onViewableItemsChanged"
    >,
): ViewabilityConfigCallbackPairs<any> | undefined {
    let { viewabilityConfig, viewabilityConfigCallbackPairs, onViewableItemsChanged } = props;

    if (viewabilityConfig || onViewableItemsChanged) {
        viewabilityConfigCallbackPairs = [
            ...(viewabilityConfigCallbackPairs! || []),
            {
                onViewableItemsChanged,
                viewabilityConfig:
                    viewabilityConfig ||
                    ({
                        viewAreaCoveragePercentThreshold: 0,
                    } as any),
            },
        ];
    }

    return viewabilityConfigCallbackPairs;
}

export function updateViewableItems(
    state: InternalState,
    ctx: StateContext,
    viewabilityConfigCallbackPairs: ViewabilityConfigCallbackPair<any>[],
    scrollSize: number,
    start: number,
    end: number,
) {
    const {
        timeouts,
        props: { data },
    } = state;
    for (const viewabilityConfigCallbackPair of viewabilityConfigCallbackPairs) {
        const viewabilityState = ensureViewabilityState(ctx, viewabilityConfigCallbackPair.viewabilityConfig.id!);
        viewabilityState.start = start;
        viewabilityState.end = end;
        if (viewabilityConfigCallbackPair.viewabilityConfig.minimumViewTime) {
            const timer: any = setTimeout(() => {
                timeouts.delete(timer);
                updateViewableItemsWithConfig(data, viewabilityConfigCallbackPair, state, ctx, scrollSize);
            }, viewabilityConfigCallbackPair.viewabilityConfig.minimumViewTime);
            timeouts.add(timer);
        } else {
            updateViewableItemsWithConfig(data, viewabilityConfigCallbackPair, state, ctx, scrollSize);
        }
    }
}

function updateViewableItemsWithConfig(
    data: readonly any[],
    viewabilityConfigCallbackPair: ViewabilityConfigCallbackPair<any>,
    state: InternalState,
    ctx: StateContext,
    scrollSize: number,
) {
    const { viewabilityConfig, onViewableItemsChanged } = viewabilityConfigCallbackPair;
    const configId = viewabilityConfig.id!;
    const viewabilityState = ensureViewabilityState(ctx, configId);
    const { viewableItems: previousViewableItems, start, end } = viewabilityState;

    const viewabilityTokens = new Map<number, ViewAmountToken>();
    for (const [containerId, value] of ctx.mapViewabilityAmountValues) {
        viewabilityTokens.set(
            containerId,
            computeViewability(
                state,
                ctx,
                viewabilityConfig,
                containerId,
                value.key,
                scrollSize,
                value.item,
                value.index,
            ),
        );
    }
    const changed: ViewToken[] = [];
    if (previousViewableItems) {
        for (const viewToken of previousViewableItems) {
            const containerId = findContainerId(ctx, viewToken.key);
            if (
                !checkIsViewable(
                    state,
                    ctx,
                    viewabilityConfig,
                    containerId,
                    viewToken.key,
                    scrollSize,
                    viewToken.item,
                    viewToken.index,
                )
            ) {
                viewToken.isViewable = false;
                changed.push(viewToken);
            }
        }
    }

    const viewableItems: ViewToken[] = [];

    for (let i = start; i <= end; i++) {
        const item = data[i];
        if (item) {
            const key = getId(state, i);
            const containerId = findContainerId(ctx, key);
            if (checkIsViewable(state, ctx, viewabilityConfig, containerId, key, scrollSize, item, i)) {
                const viewToken: ViewToken = {
                    containerId,
                    index: i,
                    isViewable: true,
                    item,
                    key,
                };
                viewableItems.push(viewToken);
                if (!previousViewableItems?.find((v) => v.key === viewToken.key)) {
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
            onViewableItemsChanged({ changed, viewableItems });
        }
    }

    for (const [containerId, value] of ctx.mapViewabilityAmountValues) {
        if (value.sizeVisible < 0) {
            ctx.mapViewabilityAmountValues.delete(containerId);
        }
    }
}

function shallowEqual<T extends object>(prev: T | undefined, next: T): boolean {
    if (!prev) return false;
    const keys = Object.keys(next) as Array<keyof T>;
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if ((prev as any)[k] !== (next as any)[k]) return false;
    }
    return true;
}

function computeViewability(
    state: InternalState,
    ctx: StateContext,
    viewabilityConfig: ViewabilityConfig,
    containerId: number,
    key: string,
    scrollSize: number,
    item: any,
    index: number,
): ViewAmountToken {
    const { sizes, positions, scroll: scrollState } = state;
    const topPad = (peek$(ctx, "stylePaddingTop") || 0) + (peek$(ctx, "headerSize") || 0);
    const { itemVisiblePercentThreshold, viewAreaCoveragePercentThreshold } = viewabilityConfig;
    const viewAreaMode = viewAreaCoveragePercentThreshold != null;
    const viewablePercentThreshold = viewAreaMode ? viewAreaCoveragePercentThreshold : itemVisiblePercentThreshold;
    const scroll = scrollState - topPad;

    const top = positions.get(key)! - scroll;
    const size = sizes.get(key)! || 0;
    const bottom = top + size;
    const isEntirelyVisible = top >= 0 && bottom <= scrollSize && bottom > top;

    const sizeVisible = isEntirelyVisible ? size : Math.min(bottom, scrollSize) - Math.max(top, 0);
    const percentVisible = size ? (isEntirelyVisible ? 100 : 100 * (sizeVisible / size)) : 0;
    const percentOfScroller = size ? 100 * (sizeVisible / scrollSize) : 0;
    const percent = isEntirelyVisible ? 100 : viewAreaMode ? percentOfScroller : percentVisible;

    const isViewable = percent >= viewablePercentThreshold!;

    const value: ViewAmountToken = {
        containerId,
        index,
        isViewable,
        item,
        key,
        percentOfScroller,
        percentVisible,
        scrollSize,
        size,
        sizeVisible,
    };

    const prev = ctx.mapViewabilityAmountValues.get(containerId);
    if (!shallowEqual(prev, value)) {
        ctx.mapViewabilityAmountValues.set(containerId, value);
        const cb = ctx.mapViewabilityAmountCallbacks.get(containerId);
        if (cb) {
            cb(value);
        }
    }

    return value;
}

function checkIsViewable(
    state: InternalState,
    ctx: StateContext,
    viewabilityConfig: ViewabilityConfig,
    containerId: number,
    key: string,
    scrollSize: number,
    item: any,
    index: number,
) {
    let value = ctx.mapViewabilityAmountValues.get(containerId);
    if (!value || value.key !== key) {
        value = computeViewability(state, ctx, viewabilityConfig, containerId, key, scrollSize, item, index);
    }

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
