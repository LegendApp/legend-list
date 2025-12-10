import { scrollTo } from "@/core/scrollTo";
import { scrollToIndex } from "@/core/scrollToIndex";
import { peek$, type StateContext, set$ } from "@/state/state";
import type { LegendListRef } from "@/types";
import { getId } from "@/utils/getId";
import { findContainerId, isFunction } from "@/utils/helpers";

export function createImperativeHandle(ctx: StateContext): LegendListRef {
    const state = ctx.state!;
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
            }
        }
    };

    const refScroller = state.refScroller;

    return {
        flashScrollIndicators: () => refScroller.current!.flashScrollIndicators(),
        getNativeScrollRef: () => refScroller.current!,
        getScrollableNode: () => refScroller.current!.getScrollableNode(),
        getScrollResponder: () => refScroller.current!.getScrollResponder(),
        getState: () => ({
            activeStickyIndex: state.activeStickyIndex,
            contentLength: state.totalSize,
            data: state.props.data,
            elementAtIndex: (index: number) => ctx.viewRefs.get(findContainerId(ctx, getId(state, index)))?.current,
            end: state.endNoBuffer,
            endBuffered: state.endBuffered,
            isAtEnd: state.isAtEnd,
            isAtStart: state.isAtStart,
            positionAtIndex: (index: number) => state.positions.get(getId(state, index))!,
            positions: state.positions,
            scroll: state.scroll,
            scrollLength: state.scrollLength,
            sizeAtIndex: (index: number) => state.sizesKnown.get(getId(state, index))!,
            sizes: state.sizesKnown,
            start: state.startNoBuffer,
            startBuffered: state.startBuffered,
        }),
        scrollIndexIntoView,
        scrollItemIntoView: ({ item, ...props }) => {
            const data = state.props.data;
            const index = data.indexOf(item);
            if (index !== -1) {
                scrollIndexIntoView({ index, ...props });
            }
        },
        scrollToEnd: (options) => {
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
            }
        },
        scrollToIndex: (params) => scrollToIndex(ctx, params),
        scrollToItem: ({ item, ...props }) => {
            const data = state.props.data;
            const index = data.indexOf(item);
            if (index !== -1) {
                scrollToIndex(ctx, { index, ...props });
            }
        },
        scrollToOffset: (params) => scrollTo(ctx, params),
        setScrollProcessingEnabled: (enabled: boolean) => {
            state.scrollProcessingEnabled = enabled;
        },
        setVisibleContentAnchorOffset: (value: number | ((val: number) => number)) => {
            const val = isFunction(value) ? value(peek$(ctx, "scrollAdjustUserOffset") || 0) : value;
            set$(ctx, "scrollAdjustUserOffset", val);
        },
    };
}
