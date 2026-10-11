import { isEndOfContentTarget } from "@/core/endOfContentTarget";
import { clearInitialScrollAnchor } from "@/core/finishInitialScroll";
import { getDataLength } from "@/core/IndexedData";
import { resolveInitialScrollOffset } from "@/core/initialScroll";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types.internal";
import { requestAdjust } from "@/utils/requestAdjust";

type Target = NonNullable<InternalState["initialScroll"]>;

export function getObservedScrollOffset(state: InternalState) {
    const observed = state.refScroller.current?.getCurrentScrollOffset?.();
    return typeof observed === "number" && Number.isFinite(observed) ? observed : (state.scrollPending ?? state.scroll);
}

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

export function schedulePreservedEndAnchorCorrection(ctx: StateContext) {
    const { state } = ctx;
    const anchor = state.initialScrollAnchor;
    if (
        !anchor ||
        state.scrollingTo ||
        state.pendingScrollResolve ||
        state.maintainingScrollAtEnd ||
        state.isDragging ||
        getDataLength(state) === 0
    )
        return false;
    // Layout can change while an adjustment is in flight. Keep its acknowledgement
    // boundary so the next frame cannot apply the outstanding delta twice.
    const correct = () => {
        if (
            state.initialScrollAnchor !== anchor ||
            state.scrollingTo ||
            state.pendingScrollResolve ||
            state.maintainingScrollAtEnd ||
            state.isDragging
        )
            return;
        const observed =
            Platform.OS !== "web" &&
            typeof state.lastNativeScroll === "number" &&
            Number.isFinite(state.lastNativeScroll)
                ? state.lastNativeScroll
                : getObservedScrollOffset(state);
        const offset = resolveInitialScrollOffset(ctx, anchor);
        const diff = offset - observed;
        if (Math.abs(diff) <= 1) return;
        if (anchor.lastRequestTime === undefined || (state.lastNativeScrollTime ?? 0) > anchor.lastRequestTime) {
            anchor.lastRequestTime = Date.now();
            anchor.lastRequestOffset = observed;
            anchor.contentOffset = offset;
            if (Platform.OS === "web") state.scroll = observed;
            requestAdjust(ctx, diff);
        }
        state.scheduledWork.frame(correct, "initialScrollAlignment");
    };
    state.scheduledWork.frame(correct, "initialScrollAlignment");
    return true;
}

export function clearFinishedBootstrapInitialScrollTargetIfMovedAway(ctx: StateContext, observedOffset?: number) {
    const { state } = ctx;
    const anchor = state.initialScrollAnchor;
    if (!anchor || state.scrollingTo) return;
    const observed = observedOffset ?? getObservedScrollOffset(state);
    const target = anchor.contentOffset ?? resolveInitialScrollOffset(ctx, anchor);
    // Native clamping and MVCP can overshoot a resize correction. Drag handlers
    // release ownership explicitly; an offset during native alignment is ambiguous.
    // Web acknowledgements stay inside the outstanding request's interval.
    if (
        state.scheduledWork.has("initialScrollAlignment") &&
        (Platform.OS !== "web" ||
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
        Math.abs(getObservedScrollOffset(state) - (target.contentOffset ?? resolveInitialScrollOffset(ctx, target))) > 1
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
        next.contentOffset = target.contentOffset;
        state.initialScrollAnchor = next;
        schedulePreservedEndAnchorCorrection(ctx);
    }
}
