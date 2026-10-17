import { IsNewArchitecture } from "@/constants-platform";
import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { cancelScroll } from "@/core/cancelScroll";
import { invalidateFixedItemSizes } from "@/core/containerItemMetadata";
import { doMaintainScrollAtEnd, interruptMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { getDistanceFromEnd, getObservedScrollOffset } from "@/core/emitMetrics";
import { supersedeInitialScroll } from "@/core/finishInitialScroll";
import { getStartOffsetAdjustment } from "@/core/getStartOffsetAdjustment";
import { retargetActiveInitialScrollAtEnd } from "@/core/initialScrollLifecycle";
import { scheduleContainerLayout } from "@/core/scheduleContainerLayout";
import { scrollElementIntoView } from "@/core/scrollElementIntoView";
import { getScrollRequestTracker } from "@/core/scrollRequestTracker";
import { findPositionIndexAtOrBeforeOffset, scrollTo } from "@/core/scrollTo";
import { scrollToEnd } from "@/core/scrollToEnd";
import { scrollToIndex } from "@/core/scrollToIndex";
import { setContentInsetOverride } from "@/core/updateContentMetrics";
import { updateItemSizes } from "@/core/updateItemSizes";
import { updateScroll } from "@/core/updateScroll";
import { updateViewableItems } from "@/core/viewability";
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
import type { LegendListInternalRef } from "@/types.internal";
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
        !!state.activeSizeAnimations?.size ||
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

    const runWhenReady = (token: number, run: () => void, isReady: () => boolean) => {
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
                run();
                return;
            }

            state.scheduledWork.frame(check, "imperativeScrollReady");
        };

        state.scheduledWork.frame(check, "imperativeScrollReady");
    };

    const runScrollRequest = (token: number, resolve: () => void, run: () => boolean, isReady = () => true) => {
        const runNow = () => scrollRequestTracker.runNow(token, resolve, run);

        if (isSettlingAfterDataChange() || !isReady()) {
            runWhenReady(token, runNow, isReady);
        } else {
            runNow();
        }
    };
    const runScrollWithPromise = (run: () => boolean, isReady = () => true) =>
        new Promise<void>((resolve) => {
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
                    pendingScroll.resolve,
                    () => scrollToEnd(ctx, pendingScroll.options),
                    () => isScrollToIndexReady(state.props.data.length - 1, true),
                );
            }
        }
    };

    const scrollIndexIntoView = (options: Parameters<LegendListRef["scrollIndexIntoView"]>[0]) => {
        if (state) {
            const { index, viewportMargin, ...rest } = options;
            if (index < 0 || index >= state.props.data.length) return false;
            const observed = getObservedScrollOffset(ctx);
            const position = calculateOffsetForIndex(ctx, index) + getStartOffsetAdjustment(ctx);
            const size = (getItemSizeAtIndex(ctx, index) ?? 0) - ctx.scrollAxisGap;
            const above = position < observed + (viewportMargin?.top ?? 0);
            const below =
                position + size >
                observed + state.scrollLength - getContentInsetEnd(ctx) - (viewportMargin?.bottom ?? 0);
            if (above || below) {
                const viewPosition = above ? 0 : 1;
                scrollToIndex(ctx, {
                    ...rest,
                    index,
                    viewOffset: above ? (viewportMargin?.top ?? 0) : -(viewportMargin?.bottom ?? 0),
                    viewPosition,
                });
                return true;
            }
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
            const index = findPositionIndexAtOrBeforeOffset(ctx, state.scroll - getStartOffsetAdjustment(ctx));
            if (index !== undefined && state.positions[index] !== undefined) {
                state.visibleContentAnchor = {
                    key: getId(state, index),
                    offset: state.scroll - state.positions[index]!,
                };
            }
        }
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

    return {
        anchorVisibleContent: (key) => {
            if (peek$(ctx, "isFollowingEnd") && peek$(ctx, "isAtEnd")) return;
            const observed = getObservedScrollOffset(ctx);
            updateScroll(ctx, observed, true, { markHasScrolled: false });
            const index = state.indexByKey.get(key);
            if (index !== undefined && state.positions[index] !== undefined) {
                interruptMaintainScrollAtEnd(ctx);
                state.visibleContentAnchor = { key, offset: state.scroll - state.positions[index]! };
            }
        },
        cancelScroll: () => cancelScroll(ctx),
        clearCaches,
        flashScrollIndicators: () => refScroller.current!.flashScrollIndicators(),
        getAnimatableRef: () => refScroller.current!.getNativeScrollRef?.() ?? refScroller.current!,
        getNativeScrollRef: () => refScroller.current!,
        getScrollAnchor: () => {
            if (
                !state.didFinishInitialScroll ||
                state.freshDataTransitionEpoch !== state.handledFreshDataTransitionEpoch
            )
                return undefined;
            const observed = getObservedScrollOffset(ctx);
            const startAdjustment = getStartOffsetAdjustment(ctx);
            const index = findPositionIndexAtOrBeforeOffset(ctx, observed - startAdjustment) ?? 0;
            const key = state.props.data[index] === undefined ? undefined : getId(state, index);
            return key === undefined
                ? undefined
                : { key, offset: observed - startAdjustment - calculateOffsetForIndex(ctx, index) };
        },
        getScrollableNode: () => refScroller.current!.getScrollableNode(),
        getScrollResponder: () => refScroller.current!.getScrollResponder(),
        getState: () => ({
            activeStickyIndex: peek$(ctx, "activeStickyIndex"),
            contentLength: getContentSize(ctx),
            data: state.props.data,
            dataEpoch: state.freshDataTransitionEpoch,
            dataKey: state.props.dataKey,
            distanceFromEnd: getDistanceFromEnd(ctx),
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
        reportContentInset: (inset) => {
            const didChange = setContentInsetOverride(ctx, inset);
            updateScroll(ctx, state.scroll, true, { markHasScrolled: false });
            if (didChange) {
                const didRetargetInitial = retargetActiveInitialScrollAtEnd(ctx);
                if (!didRetargetInitial) doMaintainScrollAtEnd(ctx);
            }
        },
        reportViewabilityInsetEndInternal: (inset) => {
            const next = Number.isFinite(inset) ? Math.max(0, inset) : 0;
            if (next === (state.viewabilityInsetEnd ?? 0)) {
                return;
            }
            state.viewabilityInsetEnd = next;
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
        scrollElementIntoView: ({ element, viewportMargin, animated, viewPosition }) => {
            const target = { element, viewPosition, viewportMargin };
            return runScrollWithPromise(() => {
                state.scrollElementTarget = target;
                return scrollElementIntoView(ctx, animated);
            }).finally(() => {
                if (state.scrollElementTarget === target) state.scrollElementTarget = undefined;
            });
        },
        scrollIndexIntoView: (options) => runScrollWithPromise(() => scrollIndexIntoView(options)),
        scrollItemIntoView: ({ item, ...props }) =>
            runScrollWithPromise(() => {
                const data = state.props.data;
                const index = data.indexOf(item);
                if (index !== -1) {
                    scrollIndexIntoView({ index, ...props });
                    return true;
                }
                return false;
            }),
        scrollToEnd: (options) =>
            new Promise<void>((resolve) => {
                const token = scrollRequestTracker.start(resolve);
                state.endFollowInterrupted = false;
                if (state.props.maintainScrollAtEnd) set$(ctx, "isFollowingEnd", true);
                state.pendingScrollToEnd = {
                    options,
                    resolve,
                    token,
                };

                scheduleImperativeScrollCommit?.();
                supersedeInitialScroll(ctx);
                if (!scheduleImperativeScrollCommit) {
                    state.runPendingScrollToEnd?.();
                }
            }),
        scrollToIndex: (params) => {
            return runScrollWithPromise(
                () => {
                    scrollToIndex(ctx, params);
                    return true;
                },
                params.index >= 0 ? () => isScrollToIndexReady(params.index) : undefined,
            );
        },
        scrollToItem: ({ item, ...props }) =>
            runScrollWithPromise(() => {
                const data = state.props.data;
                const index = data.indexOf(item);
                if (index !== -1) {
                    scrollToIndex(ctx, { index, ...props });
                    return true;
                }
                return false;
            }),
        scrollToKey: ({ key, ...params }) =>
            runScrollWithPromise(
                () => {
                    const index = state.indexByKey.get(key);
                    if (index === undefined) return false;
                    scrollToIndex(ctx, { ...params, index });
                    if (state.scrollingTo) state.scrollingTo.key = key;
                    return true;
                },
                () => {
                    const index = state.indexByKey.get(key);
                    return index !== undefined && isScrollToIndexReady(index);
                },
            ),
        scrollToOffset: (params) =>
            runScrollWithPromise(() => {
                scrollTo(ctx, params);
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
