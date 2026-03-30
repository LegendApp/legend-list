import { flushDeferredPositionsForExactRead } from "@/core/deferredPositions";
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
import type { LegendListRef } from "@/types.base";
import { getId } from "@/utils/getId";
import { getScrollVelocity } from "@/utils/getScrollVelocity";
import { hasActiveMVCPAnchorLock } from "@/utils/hasActiveMVCPAnchorLock";
import { findContainerId, isFunction } from "@/utils/helpers";

export function createImperativeHandle(ctx: StateContext): LegendListRef {
    const state = ctx.state;
    const IMPERATIVE_SCROLL_SETTLE_MAX_WAIT_MS = 800;
    const IMPERATIVE_SCROLL_SETTLE_STABLE_FRAMES = 2;
    let imperativeScrollToken = 0;

    const isSettlingAfterDataChange = () =>
        !!state.didDataChange ||
        !!state.didColumnsChange ||
        state.queuedMVCPRecalculate !== undefined ||
        state.ignoreScrollFromMVCP !== undefined ||
        hasActiveMVCPAnchorLock(state);

    const runWhenSettled = (token: number, run: () => void) => {
        const startedAt = Date.now();
        let stableFrames = 0;

        const check = () => {
            if (token !== imperativeScrollToken) {
                return;
            }

            if (isSettlingAfterDataChange()) {
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

    const runScrollWithPromise = (run: () => boolean) =>
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

            if (isSettlingAfterDataChange()) {
                runWhenSettled(token, runNow);
                return;
            }

            runNow();
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

        state.totalSizeExact = 0;
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
            isAtEnd: state.isAtEnd,
            isAtStart: state.isAtStart,
            isEndReached: state.isEndReached!,
            isStartReached: state.isStartReached!,
            listen: <T extends LegendListListenerType>(signalName: T, cb: (value: ListenerTypeValueMap[T]) => void) =>
                listen$(ctx, signalName, cb),
            listenToPosition: (key: string, cb: (value: number) => void) => listenPosition$(ctx, key, cb),
            positionAtIndex: (index: number) => {
                flushDeferredPositionsForExactRead(ctx);
                return state.positions[index]!;
            },
            positionByKey: (key: string) => {
                flushDeferredPositionsForExactRead(ctx);
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
            state.contentInsetOverride = inset ?? undefined;
            updateScroll(ctx, state.scroll, true);
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
            runScrollWithPromise(() => {
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
            }),
        scrollToIndex: (params) =>
            runScrollWithPromise(() => {
                scrollToIndex(ctx, params);
                return true;
            }),
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
