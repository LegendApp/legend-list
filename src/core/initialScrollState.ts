import { setInitialScrollTarget } from "@/core/initialBootstrap";
import type { StateContext } from "@/state/state";
import type { InternalState, ScrollIndexWithOffsetAndContentOffset } from "@/types.base";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

export function finishInitialScrollWithoutScroll(ctx: StateContext, state: InternalState) {
    setInitialScrollTarget(state, undefined);
    setInitialRenderState(ctx, { didInitialScroll: true });
}

export function shouldFinishInitialScrollAtOrigin(params: {
    initialScroll: ScrollIndexWithOffsetAndContentOffset;
    initialScrollAtEnd: boolean;
    initialScrollUsesOffset: boolean;
    offset: number;
}) {
    const { initialScroll, initialScrollAtEnd, initialScrollUsesOffset, offset } = params;
    if (offset !== 0 || initialScrollAtEnd) {
        return false;
    }

    if (initialScrollUsesOffset) {
        return Math.abs(initialScroll.contentOffset ?? 0) <= 1;
    }

    return (
        initialScroll.index === 0 &&
        (initialScroll.viewPosition ?? 0) === 0 &&
        Math.abs(initialScroll.viewOffset ?? 0) <= 1
    );
}

export function shouldFinishEmptyInitialScrollAtEnd(params: {
    dataLength: number;
    initialScroll: ScrollIndexWithOffsetAndContentOffset;
    initialScrollAtEnd: boolean;
    offset: number;
}) {
    const { dataLength, initialScroll, initialScrollAtEnd, offset } = params;
    return dataLength === 0 && initialScrollAtEnd && offset === 0 && initialScroll.viewPosition === 1;
}

export function shouldRearmFinishedEmptyInitialScrollAtEnd(params: {
    dataLength: number;
    didFinishInitialScroll: boolean;
    initialScroll: ScrollIndexWithOffsetAndContentOffset | undefined;
    initialScrollUsesOffset: boolean;
}) {
    const { dataLength, didFinishInitialScroll, initialScroll, initialScrollUsesOffset } = params;
    return !!(
        didFinishInitialScroll &&
        dataLength > 0 &&
        initialScroll &&
        !initialScrollUsesOffset &&
        initialScroll.index === 0 &&
        initialScroll.viewPosition === 1 &&
        (initialScroll.contentOffset ?? 0) === 0
    );
}

export function isInitialScrollAtEndTarget(
    initialScroll: ScrollIndexWithOffsetAndContentOffset | undefined,
    lastIndex: number,
) {
    return !!initialScroll && initialScroll.index === lastIndex && initialScroll.viewPosition === 1;
}

export function createInitialScrollAtEndTarget(params: {
    dataLength: number;
    fallbackViewOffset: number;
    initialScroll: ScrollIndexWithOffsetAndContentOffset | undefined;
}) {
    const { dataLength, fallbackViewOffset, initialScroll } = params;
    return {
        contentOffset: undefined,
        index: Math.max(0, dataLength - 1),
        viewOffset: initialScroll?.viewOffset ?? fallbackViewOffset,
        viewPosition: 1,
    } satisfies ScrollIndexWithOffsetAndContentOffset;
}
