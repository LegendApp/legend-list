import { getNativeScrollPoint } from "@/core/doScrollParams";
import { isEndOfContentTarget } from "@/core/endOfContentTarget";
import { clearInitialScrollAnchor } from "@/core/finishInitialScroll";
import { getDataLength } from "@/core/IndexedData";
import { resolveInitialScrollOffset } from "@/core/initialScroll";
import { getObservedScrollOffset } from "@/core/observedScroll";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types.internal";

type Target = NonNullable<InternalState["initialScroll"]>;

export function retargetInitialScroll(
    target: Target,
    dataLength: number,
    footerSize: number,
    padding: number,
    atEnd: boolean,
): Target {
    if (target.kind === "end")
        return { ...target, index: Math.max(0, dataLength - 1), viewOffset: -padding - footerSize };
    return {
        ...target,
        contentOffset: undefined,
        index: atEnd ? Math.max(0, dataLength - 1) : target.index,
        preserveForBottomPadding: true,
        viewOffset:
            -padding -
            (atEnd || isEndOfContentTarget(target, dataLength) || target.preserveForFooterLayout ? footerSize : 0),
        viewPosition: 1,
    };
}

function canCorrectAnchor(ctx: StateContext, anchor: Target) {
    const { state } = ctx;
    const length = getDataLength(state);
    return (
        !state.isUnmounted &&
        !state.scrollingTo &&
        !state.pendingScrollResolve &&
        !state.maintainingScrollAtEnd &&
        !state.isDragging &&
        length > 0 &&
        (anchor.index === undefined || anchor.index < length)
    );
}

export function schedulePreservedEndAnchorCorrection(ctx: StateContext) {
    const { state } = ctx;
    const anchor = state.initialScrollAnchor;
    if (!anchor || state.scheduledWork.has("initialScrollAlignment") || !canCorrectAnchor(ctx, anchor)) return false;
    // Layout can change while an adjustment is in flight. Keep its acknowledgement
    // boundary so the next frame cannot apply the outstanding delta twice.
    const correct = () => {
        if (state.initialScrollAnchor !== anchor || !canCorrectAnchor(ctx, anchor)) return;
        const observed =
            Platform.OS !== "web" &&
            typeof state.lastNativeScroll === "number" &&
            Number.isFinite(state.lastNativeScroll)
                ? state.lastNativeScroll
                : getObservedScrollOffset(ctx, state.scrollPending);
        const offset = resolveInitialScrollOffset(ctx, anchor);
        if (Math.abs(offset - observed) <= 1) {
            anchor.lastRequestOffset = undefined;
            anchor.lastRequestTime = undefined;
            return;
        }
        const scroller = state.refScroller.current;
        if (!scroller) return;
        if (
            Platform.OS === "web" ||
            anchor.lastRequestTime === undefined ||
            (state.lastNativeScrollTime ?? 0) > anchor.lastRequestTime
        ) {
            anchor.lastRequestTime = Date.now();
            anchor.lastRequestOffset = observed;
            anchor.contentOffset = offset;
            // An absolute request stays correct if layout already clamped the viewport.
            state.scroll = offset;
            scroller.scrollTo({ animated: false, ...getNativeScrollPoint(ctx, offset) });
            state.triggerCalculateItemsInView?.();
        }
        if (state.initialScrollAnchor === anchor) state.scheduledWork.frame(correct, "initialScrollAlignment");
    };
    // Wait for React to commit the DOM extent, then retry any silent clamp on a frame.
    if (Platform.OS === "web") state.scheduledWork.microtask(correct, "initialScrollAlignment");
    else state.scheduledWork.frame(correct, "initialScrollAlignment");
    return true;
}

export function clearFinishedBootstrapInitialScrollTargetIfMovedAway(
    ctx: StateContext,
    observedOffset?: number,
    nativeGeometryChanged?: boolean,
) {
    const { state } = ctx;
    const anchor = state.initialScrollAnchor;
    if (!anchor || state.scrollingTo) return;
    const observed = observedOffset ?? getObservedScrollOffset(ctx, state.scrollPending);
    const target = anchor.contentOffset ?? resolveInitialScrollOffset(ctx, anchor);
    // A correction may report an intermediate offset or a clamp as native geometry changes.
    if (
        state.scheduledWork.has("initialScrollAlignment") &&
        (nativeGeometryChanged ||
            (anchor.lastRequestOffset !== undefined &&
                observed >= Math.min(anchor.lastRequestOffset, target) - 1 &&
                observed <= Math.max(anchor.lastRequestOffset, target) + 1))
    )
        return;
    if (Math.abs(observed - target) <= 1) return;
    if ((anchor.preserveForBottomPadding || anchor.preserveForFooterLayout) && peek$(ctx, "isAtEnd")) return;
    // A revealed list belongs to the user once they leave its settled target.
    // Keeping a padding-only anchor here would pull them back on the next resize.
    clearInitialScrollAnchor(state);
}

export function updateInitialScrollAnchor(
    ctx: StateContext,
    options: {
        dataLength: number;
        initialScrollAtEnd: boolean;
        stylePaddingEnd: number;
        didDataChange?: boolean;
        footerSize?: number;
    },
) {
    const { state } = ctx;
    const target = state.initialScrollAnchor;
    if (!target) return;
    const { dataLength, initialScrollAtEnd, stylePaddingEnd, didDataChange, footerSize } = options;
    if (didDataChange && !initialScrollAtEnd) {
        clearInitialScrollAnchor(state);
        return;
    }
    if (
        !dataLength ||
        (footerSize !== undefined &&
            target.kind !== "end" &&
            !target.preserveForFooterLayout &&
            !isEndOfContentTarget(target, dataLength))
    )
        return;
    if (
        Math.abs(
            getObservedScrollOffset(ctx, state.scrollPending) -
                (target.contentOffset ?? resolveInitialScrollOffset(ctx, target)),
        ) > 1
    ) {
        if (target.preserveForFooterLayout) {
            target.preserveForFooterLayout = undefined;
            target.preserveForBottomPadding = true;
        }
        return;
    }
    if (initialScrollAtEnd || target.preserveForBottomPadding) {
        const next = retargetInitialScroll(
            target,
            dataLength,
            footerSize ?? peek$(ctx, "footerSize") ?? 0,
            stylePaddingEnd,
            initialScrollAtEnd,
        );
        if (footerSize !== undefined && next.index === target.index && next.viewOffset === target.viewOffset) {
            next.preserveForFooterLayout = undefined;
        }
        next.contentOffset = target.contentOffset ?? getObservedScrollOffset(ctx, state.scrollPending);
        state.scheduledWork.cancel("initialScrollAlignment");
        state.initialScrollAnchor = next;
        schedulePreservedEndAnchorCorrection(ctx);
    }
}
