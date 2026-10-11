import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { clearInitialScrollAnchor } from "@/core/finishInitialScroll";
import { materializeFixedLayoutStoreIndex, materializeFixedLayoutStorePrefix } from "@/core/fixedLayoutMaterialization";
import { getDataLength } from "@/core/IndexedData";
import { syncLayoutStoreState } from "@/core/layoutStoreLifecycle";
import { scrollTo } from "@/core/scrollTo";
import { clampScrollIndex } from "@/core/scrollToIndex";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";
import type { ScrollIndexWithOffset, ScrollIndexWithOffsetAndContentOffset } from "@/types.base";
import { getItemSizeAtIndex } from "@/utils/getItemSize";
import { resetInitialRenderState } from "@/utils/setInitialRenderState";

type InternalInitialScrollTarget = NonNullable<StateContext["state"]["initialScroll"]>;

export function dispatchInitialScroll(
    ctx: StateContext,
    params: {
        forceScroll: boolean;
        resolvedOffset: number;
        target: InternalInitialScrollTarget;
        waitForCompletionFrame?: boolean;
    },
) {
    const { forceScroll, resolvedOffset, target, waitForCompletionFrame } = params;
    const requestedIndex = target.index;
    const index = requestedIndex !== undefined ? clampScrollIndex(requestedIndex, getDataLength(ctx.state)) : undefined;
    const itemSize = getItemSizeAtIndex(ctx, index);

    scrollTo(ctx, {
        animated: false,
        forceScroll,
        index: index !== undefined && index >= 0 ? index : undefined,
        isInitialScroll: true,
        itemSize,
        kind: target.kind === "end" ? "end" : undefined,
        offset: resolvedOffset,
        precomputedWithViewOffset: true,
        viewOffset: target.viewOffset,
        viewPosition: target.viewPosition,
        viewPositionFallback: target.viewPositionFallback,
        waitForInitialScrollCompletionFrame: waitForCompletionFrame,
    });
}

export function setInitialScrollTarget(
    ctx: StateContext,
    target: InternalInitialScrollTarget,
    options?: {
        resetDidFinish?: boolean;
    },
) {
    const { state } = ctx;
    state.scheduledWork.cancel("initialScrollCompletion");
    clearInitialScrollAnchor(state);
    state.initialScroll = { kind: "index", ...state.initialScroll, ...target };

    if (options?.resetDidFinish) {
        resetInitialRenderState(ctx, { resetInitialScroll: true });
    }
}

export function resolveInitialScrollOffset(
    ctx: StateContext,
    initialScroll: ScrollIndexWithOffset & { kind?: "offset" | "index" | "end" },
) {
    const state = ctx.state;
    if ((initialScroll.kind ?? state.initialScroll?.kind) === "offset") {
        return (initialScroll as ScrollIndexWithOffsetAndContentOffset).contentOffset ?? 0;
    }

    const materialize =
        initialScroll.kind === "end" ? materializeFixedLayoutStoreIndex : materializeFixedLayoutStorePrefix;
    if (materialize(ctx, initialScroll.index)) {
        syncLayoutStoreState(ctx);
    }
    if (initialScroll.kind === "end") return Math.max(0, getContentSize(ctx) - state.scrollLength);
    const baseOffset = initialScroll.index !== undefined ? calculateOffsetForIndex(ctx, initialScroll.index) : 0;
    const resolvedOffset = calculateOffsetWithOffsetPosition(ctx, baseOffset, initialScroll);
    return clampScrollOffset(ctx, resolvedOffset, initialScroll);
}

export function advanceCurrentInitialScrollSession(ctx: StateContext, options?: { forceScroll?: boolean }) {
    const state = ctx.state;
    const { initialScroll, queuedInitialLayout, scrollingTo } = state;
    const isInitialScrollInProgress = !!scrollingTo?.isInitialScroll;
    const isOffset = initialScroll?.kind === "offset";
    if (
        !initialScroll ||
        state.didFinishInitialScroll ||
        (scrollingTo && !isInitialScrollInProgress) ||
        (!isOffset && !queuedInitialLayout && !isInitialScrollInProgress)
    )
        return false;

    const resolvedOffset = resolveInitialScrollOffset(ctx, initialScroll);
    const activeOffset = scrollingTo ? (scrollingTo.targetOffset ?? scrollingTo.offset) : undefined;
    const didOffsetChange =
        initialScroll.contentOffset === undefined || Math.abs(initialScroll.contentOffset - resolvedOffset) > 1;
    if (
        !isOffset &&
        !options?.forceScroll &&
        !didOffsetChange &&
        isInitialScrollInProgress &&
        Math.abs(activeOffset! - resolvedOffset) <= 1
    )
        return false;
    if (
        options?.forceScroll &&
        (isOffset || isInitialScrollInProgress) &&
        Math.abs(state.scroll - resolvedOffset) <= 1 &&
        Math.abs(state.scrollPending - resolvedOffset) <= 1
    )
        return false;

    if (!isOffset && didOffsetChange) {
        setInitialScrollTarget(ctx, { ...initialScroll, contentOffset: resolvedOffset });
    }
    const forceScroll =
        options?.forceScroll ??
        (!!queuedInitialLayout ||
            (isOffset ? !!state.lastLayout && state.scrollLength > 0 : isInitialScrollInProgress && didOffsetChange));
    dispatchInitialScroll(ctx, { forceScroll, resolvedOffset, target: initialScroll });
    return true;
}
