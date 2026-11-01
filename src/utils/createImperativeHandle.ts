import { IsNewArchitecture } from "@/constants-platform";
import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { cancelScroll } from "@/core/cancelScroll";
import { getContentInsetTop } from "@/core/clampScrollOffset";
import { invalidateFixedItemSizes } from "@/core/containerItemMetadata";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { supersedeInitialScroll } from "@/core/finishInitialScroll";
import { armAppScrollRearm, interruptMaintainScrollAtEnd } from "@/core/finishMaintainScrollAtEnd";
import { getStartOffsetAdjustment } from "@/core/getStartOffsetAdjustment";
import { retargetActiveInitialScrollAtEnd } from "@/core/initialScrollLifecycle";
import { clearItemSizeEstimates } from "@/core/itemSizeCache";
import { getObservedScrollOffset } from "@/core/observedScroll";
import { scheduleContainerLayout } from "@/core/scheduleContainerLayout";
import { getScrollRequestTracker, type ScrollRequestRun } from "@/core/scrollRequestTracker";
import { findVisibleItemIndex, scrollTo } from "@/core/scrollTo";
import { scrollToEnd } from "@/core/scrollToEnd";
import { scrollToIndex } from "@/core/scrollToIndex";
import { setContentInsetOverride } from "@/core/updateContentMetrics";
import { updateItemSizes } from "@/core/updateItemSizes";
import { updateScroll } from "@/core/updateScroll";
import { updateViewableItems } from "@/core/viewability";
import { isScreenReaderEnabled } from "@/platform/screenReader";
import { getContentInsetEnd } from "@/state/getContentInsetEnd";
import { getContentSize } from "@/state/getContentSize";
import {
    type LegendListListenerType,
    type ListenerTypeValueMap,
    listen$,
    listenPosition$,
    peek$,
    type StateContext,
    set$,
} from "@/state/state";
import type { LegendListAverageItemSize, LegendListRef } from "@/types.base";
import type { LegendListInternalRef, ScrollResolve } from "@/types.internal";
import { getId } from "@/utils/getId";
import { areKnownOrFixedItemSizesAvailable, getItemSizeAtIndex } from "@/utils/getItemSize";
import { getScrollVelocity } from "@/utils/getScrollVelocity";
import { findContainerId, isFunction } from "@/utils/helpers";

const DEFAULT_AVERAGE_ITEM_SIZE_TYPE = "default";

function getAverageItemSizes(state: StateContext["state"]): Record<string, LegendListAverageItemSize> {
    const averageItemSizes: Record<string, LegendListAverageItemSize> = {};

    for (const itemType in state.averageSizes) {
        const averageSize = state.averageSizes[itemType];
        if (averageSize) {
            averageItemSizes[itemType || DEFAULT_AVERAGE_ITEM_SIZE_TYPE] = {
                average: averageSize.avg,
                count: averageSize.num,
            };
        }
    }

    return averageItemSizes;
}

function triggerMountedContainerLayouts(ctx: StateContext) {
    if (IsNewArchitecture) {
        scheduleContainerLayout(ctx);
    } else {
        for (const triggerLayout of ctx.containerLayoutTriggers.values()) {
            triggerLayout();
        }
    }
}

export function createImperativeHandle(
    ctx: StateContext,
    scheduleImperativeScrollCommit?: () => void,
): LegendListInternalRef {
    const state = ctx.state;
    const scrollRequestTracker = getScrollRequestTracker(ctx);
    const IMPERATIVE_SCROLL_SETTLE_MAX_WAIT_MS = 800;
    const IMPERATIVE_SCROLL_SETTLE_STABLE_FRAMES = 2;

    const isSettlingAfterDataChange = () =>
        !!state.didDataChange ||
        !!state.didColumnsChange ||
        state.scheduledWork.has("mvcpRecalculate") ||
        state.ignoreScrollFromMVCP !== undefined;

    const isScrollToIndexReady = (targetIndex: number, allowEmpty = false) => {
        const props = state.props;
        const dataLength = props.data.length;
        const anchorIndex = props.anchoredEndSpace?.anchorIndex;

        if (targetIndex < 0) {
            return allowEmpty;
        }
        if (targetIndex >= dataLength) {
            return false;
        }
        if (anchorIndex === undefined || anchorIndex < 0 || anchorIndex >= dataLength || targetIndex < anchorIndex) {
            return true;
        }

        return areKnownOrFixedItemSizesAvailable(ctx, anchorIndex, dataLength - 1);
    };

    const getIndexForKey = (key: string) => {
        if (state.props.keyExtractor) return state.indexByKey.get(key);
        const index = Number(key);
        return Number.isInteger(index) && String(index) === key && index >= 0 && index < state.props.data.length
            ? index
            : undefined;
    };

    const runScrollRequest = (token: number, resolve: ScrollResolve, run: ScrollRequestRun, isReady: () => boolean) => {
        const runNow = () => scrollRequestTracker.runNow(token, resolve, run);
        if (!isSettlingAfterDataChange() && isReady()) {
            runNow();
            return;
        }

        const startedAt = Date.now();
        let stableFrames = 0;

        const check = () => {
            if (!scrollRequestTracker.isCurrent(token)) {
                return;
            }

            if (isSettlingAfterDataChange() || !isReady()) {
                stableFrames = 0;
            } else {
                stableFrames += 1;
            }

            const timedOut = Date.now() - startedAt >= IMPERATIVE_SCROLL_SETTLE_MAX_WAIT_MS;
            if (stableFrames >= IMPERATIVE_SCROLL_SETTLE_STABLE_FRAMES || timedOut) {
                runNow();
                return;
            }

            state.scheduledWork.frame(check, "imperativeScrollReady");
        };

        state.scheduledWork.frame(check, "imperativeScrollReady");
    };

    const runScrollWithPromise = (run: ScrollRequestRun, isReady = () => true) =>
        new Promise<void>((resolve) => {
            if (state.isUnmounted) {
                resolve();
                return;
            }
            const token = scrollRequestTracker.start(resolve);

            supersedeInitialScroll(ctx);
            runScrollRequest(token, resolve, run, isReady);
        });

    state.runPendingScrollToEnd = () => {
        const pendingScroll = state.pendingScrollToEnd;

        if (pendingScroll) {
            state.pendingScrollToEnd = undefined;

            if (scrollRequestTracker.isCurrent(pendingScroll.token)) {
                runScrollRequest(
                    pendingScroll.token,
                    state.pendingScrollResolve!,
                    () => (state.props.data.length === 0 ? "unreachable" : scrollToEnd(ctx, pendingScroll.options)),
                    () => isScrollToIndexReady(state.props.data.length - 1, true),
                );
            }
        }
    };

    const scrollIndexIntoView = (
        options: Parameters<LegendListRef["scrollIndexIntoView"]>[0],
    ): boolean | "unreachable" => {
        const { index, itemOffset, itemLength, viewportMargin, ...rest } = options;
        if (index < 0 || index >= state.props.data.length) return "unreachable";
        const hasRegion = itemOffset !== undefined || itemLength !== undefined;
        const observed = getObservedScrollOffset(ctx);
        const position = calculateOffsetForIndex(ctx, index) + getStartOffsetAdjustment(ctx) + (itemOffset ?? 0);
        const size = hasRegion ? (itemLength ?? 0) : (getItemSizeAtIndex(ctx, index) ?? 0) - ctx.scrollAxisGap;
        const insetTop = getContentInsetTop(ctx);
        const viewportLength = state.scrollLength - insetTop - getContentInsetEnd(ctx);
        const viewportStart = observed + insetTop + (viewportMargin?.start ?? 0);
        const viewportEnd = observed + insetTop + viewportLength - (viewportMargin?.end ?? 0);
        if (!hasRegion && position <= viewportStart && position + size >= viewportEnd) return false;
        const above = position < viewportStart;
        const below = position + size > viewportEnd;
        if (above || below) {
            const alignStart = above || size > viewportEnd - viewportStart;
            scrollToIndex(ctx, {
                ...rest,
                index,
                viewOffset: hasRegion
                    ? (alignStart ? (viewportMargin?.start ?? 0) : viewportLength - (viewportMargin?.end ?? 0) - size) -
                      (itemOffset ?? 0)
                    : alignStart
                      ? (viewportMargin?.start ?? 0)
                      : -(viewportMargin?.end ?? 0),
                viewPosition: hasRegion || alignStart ? 0 : 1,
                viewPositionFallback: "start",
            });
            return true;
        }
        return false;
    };

    const refScroller = state.refScroller;
    const clearCaches = (options?: Parameters<LegendListRef["clearCaches"]>[0]) => {
        const mode = options?.mode ?? "sizes";

        if (
            mode === "sizes" &&
            state.didContainersLayout &&
            !peek$(ctx, "isFollowingEnd") &&
            !state.scrollingTo &&
            !scrollRequestTracker.isWaitingToRun()
        ) {
            const viewportStart = state.scroll - getStartOffsetAdjustment(ctx);
            const index = findVisibleItemIndex(ctx, viewportStart, viewportStart + state.scrollLength);
            if (index !== undefined) {
                state.visibleContentAnchor = {
                    key: getId(state, index),
                    offset: state.scroll - state.positions[index]!,
                    sizeOnly: true,
                };
            }
        }
        clearItemSizeEstimates(ctx);
        // Keep rendered sizes as estimates so native content cannot collapse before remeasurement.
        state.sizesKnown.clear();
        invalidateFixedItemSizes(state);
        for (const key in state.averageSizes) {
            delete state.averageSizes[key];
        }
        state.positionRecalculationStartIndex = 0;
        state.scrollForNextCalculateItemsInView = undefined;

        state.pendingTotalSize = undefined;

        if (mode === "full") {
            state.visibleContentAnchor = undefined;
            state.sizes.clear();
            state.totalSize = 0;
            set$(ctx, "totalSize", 0);
            state.indexByKey.clear();
            state.idCache.length = 0;
            state.positions.length = 0;
            state.columns.length = 0;
            state.columnSpans.length = 0;
        }

        triggerMountedContainerLayouts(ctx);
        state.triggerCalculateItemsInView?.({ doMVCP: mode === "sizes", forceFullItemPositions: true });
    };

    const reportContentInset = (inset: Parameters<LegendListInternalRef["reportContentInset"]>[0], follow = true) => {
        const didChange = setContentInsetOverride(ctx, inset);
        updateScroll(ctx, state.scroll, true, { markHasScrolled: false });
        if (didChange && follow) {
            const didRetargetInitial = retargetActiveInitialScrollAtEnd(ctx);
            if (!didRetargetInitial) doMaintainScrollAtEnd(ctx);
        }
    };

    return {
        anchorVisibleContent: ({ key, hold = true } = {}) => {
            if (
                !state.didFinishInitialScroll ||
                state.freshDataTransitionEpoch !== state.handledFreshDataTransitionEpoch
            )
                return undefined;
            const observed = getObservedScrollOffset(ctx);
            const viewportStart = observed - getStartOffsetAdjustment(ctx);
            const index =
                key === undefined
                    ? findVisibleItemIndex(ctx, viewportStart, viewportStart + state.scrollLength)
                    : getIndexForKey(key);
            if (index === undefined || state.positions[index] === undefined) return undefined;
            const id = getId(state, index);
            const offset = viewportStart - state.positions[index]!;
            if (hold && !(peek$(ctx, "isFollowingEnd") && peek$(ctx, "isAtEnd"))) {
                updateScroll(ctx, observed, true, { markHasScrolled: false });
                interruptMaintainScrollAtEnd(ctx);
                state.visibleContentAnchor = { key: id, offset: state.scroll - state.positions[index]! };
            }
            return { key: String(id), offset };
        },
        cancelScroll: () => {
            armAppScrollRearm(ctx);
            cancelScroll(ctx);
        },
        clearCaches,
        flashScrollIndicators: () => refScroller.current!.flashScrollIndicators(),
        getAnimatableRef: () => refScroller.current!.getNativeScrollRef?.() ?? refScroller.current!,
        getNativeScrollRef: () => refScroller.current!,
        getScrollableNode: () => refScroller.current!.getScrollableNode(),
        getScrollResponder: () => refScroller.current!.getScrollResponder(),
        getState: () => ({
            activeStickyIndex: peek$(ctx, "activeStickyIndex"),
            contentLength: getContentSize(ctx),
            data: state.props.data,
            dataKey: state.props.dataKey,
            distanceFromEnd: Math.max(0, getContentSize(ctx) - getObservedScrollOffset(ctx) - state.scrollLength),
            elementAtIndex: (index: number) => ctx.viewRefs.get(findContainerId(ctx, getId(state, index)))?.current,
            end: state.endNoBuffer,
            endBuffered: state.endBuffered,
            getAverageItemSizes: () => getAverageItemSizes(state),
            indexByKey: (key: string) => state.indexByKey.get(key),
            isAtEnd: peek$(ctx, "isAtEnd"),
            isAtStart: peek$(ctx, "isAtStart"),
            isEndReached: state.isEndReached!,
            isFollowingEnd: !!peek$(ctx, "isFollowingEnd"),
            isNearEnd: peek$(ctx, "isNearEnd"),
            isNearStart: peek$(ctx, "isNearStart"),
            isStartReached: state.isStartReached!,
            isWithinMaintainScrollAtEndThreshold: peek$(ctx, "isWithinMaintainScrollAtEndThreshold"),
            listen: <T extends LegendListListenerType>(signalName: T, cb: (value: ListenerTypeValueMap[T]) => void) =>
                listen$(ctx, signalName, cb),
            listenToPosition: (key: string, cb: (value: number) => void) => listenPosition$(ctx, key, cb),
            positionAtIndex: (index: number) => state.positions[index]!,
            positionByKey: (key: string) => {
                const index = state.indexByKey.get(key);
                return index === undefined ? undefined : state.positions[index];
            },
            scroll: state.scroll,
            scrollLength: state.scrollLength,
            scrollVelocity: getScrollVelocity(state),
            sizeAtIndex: (index: number) => state.sizesKnown.get(getId(state, index))!,
            sizes: state.sizesKnown,
            start: state.startNoBuffer,
            startBuffered: state.startBuffered,
        }),
        reportContentInset,
        reportContentInsetForScrollInternal: (inset) => reportContentInset(inset, false),
        reportViewabilityInsetEndInternal: (inset) => {
            const next = Number.isFinite(inset) ? Math.max(0, inset) : 0;
            if (next === (state.viewabilityInsetEnd ?? 0)) {
                return;
            }
            state.viewabilityInsetEnd = next;
            // The controller scrolls on the UI thread; retain ownership through trailing frames.
            if (isScreenReaderEnabled()) armAppScrollRearm(ctx);
            if (state.viewabilityConfigCallbackPairs) {
                // A keyboard can cover stationary content without a scroll event.
                // Refresh viewability only; occlusion must not initiate scrolling.
                updateViewableItems(
                    state,
                    ctx,
                    state.viewabilityConfigCallbackPairs,
                    state.scrollLength,
                    state.startNoBuffer ?? 0,
                    state.endNoBuffer ?? -1,
                    state.startBuffered,
                    state.endBuffered,
                );
            }
        },
        scrollIndexIntoView: (options) => runScrollWithPromise(() => scrollIndexIntoView(options)),
        scrollItemIntoView: ({ item, ...props }) =>
            runScrollWithPromise(() => {
                const index = state.props.data.indexOf(item);
                if (index !== -1) {
                    const result = scrollIndexIntoView({ index, ...props });
                    if (result === true && state.scrollingTo && state.props.keyExtractor)
                        state.scrollingTo.key = getId(state, index);
                    return result;
                }
                return "unreachable";
            }),
        scrollToEnd: (options) =>
            new Promise<void>((resolve) => {
                if (state.isUnmounted) {
                    resolve();
                    return;
                }
                const token = scrollRequestTracker.start(resolve);
                state.endFollowInterrupted = false;
                if (state.props.maintainScrollAtEnd) set$(ctx, "isFollowingEnd", true);
                state.pendingScrollToEnd = {
                    options,
                    token,
                };

                scheduleImperativeScrollCommit?.();
                supersedeInitialScroll(ctx);
                if (!scheduleImperativeScrollCommit) {
                    state.runPendingScrollToEnd?.();
                }
            }),
        scrollToIndex: (params) =>
            runScrollWithPromise(
                () => {
                    if (state.props.data.length === 0) return "unreachable";
                    scrollToIndex(ctx, params);
                    return true;
                },
                params.index >= 0 ? () => isScrollToIndexReady(params.index) : undefined,
            ),
        scrollToItem: ({ item, ...props }) =>
            runScrollWithPromise(() => {
                const index = state.props.data.indexOf(item);
                if (index !== -1) {
                    scrollToIndex(ctx, { index, ...props });
                    if (state.scrollingTo && state.props.keyExtractor) state.scrollingTo.key = getId(state, index);
                    return true;
                }
                return "unreachable";
            }),
        scrollToKey: ({ key, ...params }) =>
            runScrollWithPromise(
                () => {
                    const index = getIndexForKey(key);
                    if (index === undefined) return "unreachable";
                    scrollToIndex(ctx, { ...params, index });
                    if (state.scrollingTo) state.scrollingTo.key = getId(state, index);
                    return true;
                },
                () => {
                    const index = getIndexForKey(key);
                    return index !== undefined && isScrollToIndexReady(index);
                },
            ),
        scrollToOffset: (params) =>
            runScrollWithPromise(() => {
                scrollTo(ctx, { ...params, clampToContentContainerMinSize: true });
                return true;
            }),
        setItemSize: (itemKey, size) => {
            updateItemSizes(ctx, { itemKey, size });
        },
        setScrollProcessingEnabled: (enabled: boolean) => {
            state.scrollProcessingEnabled = enabled;
        },
        setVisibleContentAnchorOffset: (value: number | ((val: number) => number)) => {
            const val = isFunction(value) ? value(peek$(ctx, "scrollAdjustUserOffset") || 0) : value;
            set$(ctx, "scrollAdjustUserOffset", val);
        },
    };
}
