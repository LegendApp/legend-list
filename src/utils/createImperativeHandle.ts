import { retargetActiveInitialScrollAtEnd } from "@/core/initialScrollLifecycle";
import { scrollTo } from "@/core/scrollTo";
import { scrollToIndex } from "@/core/scrollToIndex";
import { updateScroll } from "@/core/updateScroll";
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
import { getId } from "@/utils/getId";
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

export function createImperativeHandle(ctx: StateContext): LegendListRef {
    const state = ctx.state;
    const IMPERATIVE_SCROLL_SETTLE_MAX_WAIT_MS = 800;
    const IMPERATIVE_SCROLL_SETTLE_STABLE_FRAMES = 2;
    let imperativeScrollToken = 0;

    const isSettlingAfterDataChange = () =>
        !!state.didDataChange ||
        !!state.didColumnsChange ||
        state.queuedMVCPRecalculate !== undefined ||
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
        if (
            anchorIndex === undefined ||
            anchorIndex < 0 ||
            anchorIndex >= dataLength ||
            targetIndex < anchorIndex ||
            props.getFixedItemSize
        ) {
            return true;
        }

        for (let index = anchorIndex; index < dataLength; index++) {
            if (!state.sizesKnown.has(getId(state, index))) {
                return false;
            }
        }

        return true;
    };

    const runWhenReady = (token: number, run: () => void, isReady: () => boolean) => {
        const startedAt = Date.now();
        let stableFrames = 0;

        const check = () => {
            if (token !== imperativeScrollToken) {
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

            requestAnimationFrame(check);
        };

        requestAnimationFrame(check);
    };

    const runScrollWithPromise = (run: () => boolean, isReady = () => true) =>
        new Promise<void>((resolve) => {
            // A new imperative scroll supersedes any previous unresolved one.
            const token = ++imperativeScrollToken;

            state.pendingScrollResolve?.();
            state.pendingScrollResolve = resolve;

            const runNow = () => {
                if (token !== imperativeScrollToken) {
                    return;
                }

                const didStartScroll = run();
                if (!didStartScroll || !state.scrollingTo) {
                    if (state.pendingScrollResolve === resolve) {
                        state.pendingScrollResolve = undefined;
                    }
                    resolve();
                }
            };

            if (isSettlingAfterDataChange() || !isReady()) {
                runWhenReady(token, runNow, isReady);
            } else {
                runNow();
            }
        });
    const scrollIndexIntoView = (options: Parameters<LegendListRef["scrollIndexIntoView"]>[0]) => {
        if (state) {
            const { index, ...rest } = options;
            const { startNoBuffer, endNoBuffer } = state;
            if (index < startNoBuffer || index > endNoBuffer) {
                const viewPosition = index < startNoBuffer ? 0 : 1;
                scrollToIndex(ctx, {
                    ...rest,
                    index,
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

        state.sizes.clear();
        state.sizesKnown.clear();
        for (const key in state.averageSizes) {
            delete state.averageSizes[key];
        }
        state.minIndexSizeChanged = 0;
        state.scrollForNextCalculateItemsInView = undefined;

        state.pendingTotalSize = undefined;
        state.totalSize = 0;
        set$(ctx, "totalSize", 0);

        if (mode === "full") {
            state.indexByKey.clear();
            state.idCache.length = 0;
            state.positions.length = 0;
            state.columns.length = 0;
            state.columnSpans.length = 0;
        }

        state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
    };

    return {
        clearCaches,
        flashScrollIndicators: () => refScroller.current!.flashScrollIndicators(),
        getNativeScrollRef: () => refScroller.current!,
        getScrollableNode: () => refScroller.current!.getScrollableNode(),
        getScrollResponder: () => refScroller.current!.getScrollResponder(),
        getState: () => ({
            activeStickyIndex: peek$(ctx, "activeStickyIndex"),
            contentLength: getContentSize(ctx),
            data: state.props.data,
            elementAtIndex: (index: number) => ctx.viewRefs.get(findContainerId(ctx, getId(state, index)))?.current,
            end: state.endNoBuffer,
            endBuffered: state.endBuffered,
            getAverageItemSizes: () => getAverageItemSizes(state),
            isAtEnd: peek$(ctx, "isAtEnd"),
            isAtStart: peek$(ctx, "isAtStart"),
            isEndReached: state.isEndReached!,
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
            const previousInset = state.contentInsetOverride;
            state.contentInsetOverride = inset ?? undefined;
            const didChange =
                (previousInset?.top ?? 0) !== (state.contentInsetOverride?.top ?? 0) ||
                (previousInset?.bottom ?? 0) !== (state.contentInsetOverride?.bottom ?? 0) ||
                (previousInset?.left ?? 0) !== (state.contentInsetOverride?.left ?? 0) ||
                (previousInset?.right ?? 0) !== (state.contentInsetOverride?.right ?? 0);
            updateScroll(ctx, state.scroll, true, { markHasScrolled: false });
            if (didChange) {
                retargetActiveInitialScrollAtEnd(ctx);
            }
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
            runScrollWithPromise(
                () => {
                    const data = state.props.data;
                    const stylePaddingBottom = state.props.stylePaddingBottom;
                    const index = data.length - 1;
                    if (index !== -1) {
                        const paddingBottom = stylePaddingBottom || 0;
                        const footerSize = peek$(ctx, "footerSize") || 0;
                        scrollToIndex(ctx, {
                            ...options,
                            index,
                            viewOffset: -paddingBottom - footerSize + (options?.viewOffset || 0),
                            viewPosition: 1,
                        });
                        return true;
                    }
                    return false;
                },
                () => isScrollToIndexReady(state.props.data.length - 1, true),
            ),
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
        scrollToOffset: (params) =>
            runScrollWithPromise(() => {
                scrollTo(ctx, params);
                return true;
            }),
        setScrollProcessingEnabled: (enabled: boolean) => {
            state.scrollProcessingEnabled = enabled;
        },
        setVisibleContentAnchorOffset: (value: number | ((val: number) => number)) => {
            const val = isFunction(value) ? value(peek$(ctx, "scrollAdjustUserOffset") || 0) : value;
            set$(ctx, "scrollAdjustUserOffset", val);
        },
    };
}
