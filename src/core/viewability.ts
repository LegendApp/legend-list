import { getStartOffsetAdjustment } from "@/core/getStartOffsetAdjustment";
import { getLayoutOffset } from "@/core/layoutAccessors";
import type { LooseScrollViewProps } from "@/platform/scrollview-types";
import type { StateContext } from "@/state/state";
import type {
    ViewAmountToken,
    ViewabilityConfig,
    ViewabilityConfigCallbackPair,
    ViewabilityConfigCallbackPairs,
    ViewToken,
} from "@/types.base";
import type { InternalState, LegendListPropsBase } from "@/types.internal";
import { getId } from "@/utils/getId";
import { findContainerId, warnDevOnce } from "@/utils/helpers";

type ViewabilityConfigState = StateContext["mapViewabilityConfigStates"] extends Map<string, infer State>
    ? State
    : never;

function ensureViewabilityState(ctx: StateContext, configId: string): ViewabilityConfigState {
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
    ctx?: StateContext,
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

    const configIds = new Set<string>();
    for (const pair of viewabilityConfigCallbackPairs ?? []) {
        const id = pair.viewabilityConfig.id!;
        if (configIds.has(id)) {
            warnDevOnce(
                "viewability-duplicate-config-id",
                "Each viewability config must have a unique id when using multiple configs.",
            );
        }
        configIds.add(id);
        const viewabilityState = ctx?.mapViewabilityConfigStates.get(id);
        const previousConfig = viewabilityState?.pair?.viewabilityConfig;
        if (viewabilityState) {
            viewabilityState.pair = pair;
        }
        // Effect replay can retain a pending deadline after disposing its timer.
        if (
            ctx &&
            (previousConfig !== pair.viewabilityConfig ||
                (viewabilityState?.deadline !== undefined && !ctx.state.scheduledWork.has(`viewability${id}`))) &&
            ctx.state.startNoBuffer != null &&
            ctx.state.endNoBuffer != null
        ) {
            updateViewableItems(
                ctx.state,
                ctx,
                [pair],
                ctx.state.scrollLength,
                ctx.state.startNoBuffer,
                ctx.state.endNoBuffer,
                ctx.state.startBuffered,
                ctx.state.endBuffered,
            );
        }
    }
    if (ctx) {
        for (const id of ctx.mapViewabilityConfigStates.keys()) {
            if (!configIds.has(id)) {
                ctx.state.scheduledWork.cancel(`viewability${id}`);
                ctx.mapViewabilityConfigStates.delete(id);
            }
        }
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
    startBuffered = start,
    endBuffered = end,
) {
    for (const viewabilityConfigCallbackPair of viewabilityConfigCallbackPairs) {
        const viewabilityState = ensureViewabilityState(ctx, viewabilityConfigCallbackPair.viewabilityConfig.id!);
        viewabilityState.start = start;
        viewabilityState.end = end;
        viewabilityState.startBuffered = startBuffered;
        viewabilityState.endBuffered = endBuffered;
        viewabilityState.pair = viewabilityConfigCallbackPair;
        viewabilityState.scrollSize = scrollSize;
        updateViewableItemsWithConfig(viewabilityState, state, ctx);
    }
}

function updateViewableItemsWithConfig(
    viewabilityState: ViewabilityConfigState,
    state: InternalState,
    ctx: StateContext,
) {
    // Always read the latest data, range and pair: a minimumViewTime timer runs this
    // after data or props may have changed since it was scheduled.
    const data = state.props.data;
    const { viewabilityConfig, onViewableItemsChanged } = viewabilityState.pair!;
    const scrollSize = viewabilityState.scrollSize!;
    const configId = viewabilityConfig.id!;
    const timerKey = `viewability${configId}` as const;
    const { viewableItems: previousViewableItems, start, end, startBuffered, endBuffered } = viewabilityState;

    // With minimumViewTime, a key becomes viewable only after staying visible for that long
    // without interruption. `since` records when each visible key entered; leaving clears it.
    const minimumViewTime = Math.max(0, Number(viewabilityConfig.minimumViewTime) || 0);
    let since = viewabilityState.since;
    if (minimumViewTime) {
        since ??= viewabilityState.since = new Map();
    } else if (since) {
        since = viewabilityState.since = viewabilityState.deadline = undefined;
        state.scheduledWork.cancel(timerKey);
    }
    const now = since ? performance.now() : 0;
    const visibleKeys = since && new Set<string>();
    let nextDeadline = Number.POSITIVE_INFINITY;

    let staleViewabilityAmountIds: number[] | undefined;
    for (const [containerId, value] of ctx.mapViewabilityAmountValues) {
        const nextValue = computeViewability(
            state,
            ctx,
            viewabilityConfig,
            containerId,
            value.key,
            scrollSize,
            value.item,
            value.index,
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
            const currentItem = currentIndex !== undefined ? data[currentIndex] : undefined;
            const containerId = findContainerId(ctx, viewToken.key);
            let isStillViewable = false;
            if (currentIndex !== undefined && currentItem !== undefined) {
                isStillViewable = checkIsViewable(
                    state,
                    ctx,
                    viewabilityConfig,
                    containerId,
                    viewToken.key,
                    scrollSize,
                    currentItem,
                    currentIndex,
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
        const item = data[i];
        if (item) {
            const key = getId(state, i);
            const containerId = findContainerId(ctx, key);
            if (checkIsViewable(state, ctx, viewabilityConfig, containerId, key, scrollSize, item, i)) {
                if (since) {
                    visibleKeys!.add(key);
                    const visibleSince = since.get(key) ?? now;
                    since.set(key, visibleSince);
                    const deadline = visibleSince + minimumViewTime;
                    if (!previousViewableKeys.has(key) && now < deadline) {
                        nextDeadline = Math.min(nextDeadline, deadline);
                        continue;
                    }
                }
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

    if (since) {
        for (const key of since.keys()) {
            if (!visibleKeys!.has(key)) {
                since.delete(key);
            }
        }
        // One timer per config, for the earliest key still waiting out its minimumViewTime.
        if (nextDeadline !== viewabilityState.deadline || !state.scheduledWork.has(timerKey)) {
            if (nextDeadline === Number.POSITIVE_INFINITY) {
                viewabilityState.deadline = undefined;
                state.scheduledWork.cancel(timerKey);
            } else {
                viewabilityState.deadline = nextDeadline;
                state.scheduledWork.timeout(
                    () => {
                        viewabilityState.deadline = undefined;
                        updateViewableItemsWithConfig(viewabilityState, state, ctx);
                    },
                    Math.min(nextDeadline - now, 2147483647),
                    timerKey,
                );
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

function getViewabilityLayoutOffset(ctx: StateContext, state: InternalState, index: number) {
    let offset: number | undefined;
    if (state === ctx.state) {
        offset = getLayoutOffset(ctx, index);
    } else if (state.layoutStore?.hasIndex(index)) {
        offset = state.layoutStore.getOffset(index);
    } else if (index >= 0) {
        offset = state.positions[index];
    }
    return offset;
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
    // Content inset can reserve empty scroll range without covering any pixels.
    // Only an integration's explicitly reported occlusion clips viewability.
    scrollSize = Math.max(0, scrollSize - (state.viewabilityInsetEnd ?? 0));
    const { sizes, scroll: scrollState } = state;
    const topPad = getStartOffsetAdjustment(ctx);
    const { itemVisiblePercentThreshold, viewAreaCoveragePercentThreshold } = viewabilityConfig;
    const viewAreaMode = viewAreaCoveragePercentThreshold != null;
    const viewablePercentThreshold = viewAreaMode ? viewAreaCoveragePercentThreshold : itemVisiblePercentThreshold;
    const scroll = scrollState - topPad;
    const position = getViewabilityLayoutOffset(ctx, state, index);
    const size = sizes.get(key)! || 0;

    if (position === undefined) {
        const value: ViewAmountToken = {
            containerId,
            index,
            isViewable: false,
            item,
            key,
            percentOfScroller: 0,
            percentVisible: 0,
            scrollSize,
            size,
            sizeVisible: -1,
        };

        const prev = ctx.mapViewabilityAmountValues.get(containerId);
        if (!areViewabilityAmountTokensEqual(prev, value)) {
            ctx.mapViewabilityAmountValues.set(containerId, value);
            const cb = ctx.mapViewabilityAmountCallbacks.get(containerId);
            if (cb) {
                cb(value);
            }
        }
        return value;
    }

    const top = position - scroll;
    const bottom = top + size;
    const isEntirelyVisible = top >= 0 && bottom <= scrollSize && bottom > top;

    const sizeVisible = isEntirelyVisible ? size : Math.min(bottom, scrollSize) - Math.max(top, 0);
    const percentVisible = size ? (isEntirelyVisible ? 100 : 100 * (sizeVisible / size)) : 0;
    const percentOfScroller = size && scrollSize > 0 ? 100 * (sizeVisible / scrollSize) : 0;
    const percent = isEntirelyVisible ? 100 : viewAreaMode ? percentOfScroller : percentVisible;

    // A zero-size viewport means an integration covers everything: no row is
    // viewable, and coverage ratios stay finite. Zero-size or edge-touching
    // rows keep their historical percent-of-threshold result.
    const isViewable = scrollSize > 0 && percent >= viewablePercentThreshold!;

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
    if (!areViewabilityAmountTokensEqual(prev, value)) {
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
    if (!value || value.key !== key || value.index !== index) {
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
