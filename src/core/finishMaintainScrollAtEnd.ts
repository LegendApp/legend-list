import { USER_MOMENTUM_STALL_TIMEOUT_MS } from "@/constants";
import { cancelImperativeScroll, syncScrollActive } from "@/core/cancelImperativeScroll";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { getAlignItemsAtEndPadding } from "@/core/updateContentMetricsState";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext, set$ } from "@/state/state";
import { requestAdjust } from "@/utils/requestAdjust";

export function interruptMaintainScrollAtEnd(ctx: StateContext) {
    const { state } = ctx;
    const maintaining = state.maintainingScrollAtEnd;
    state.endFollowInterrupted = true;
    set$(ctx, "isFollowingEnd", false);
    if (maintaining === "animated" || maintaining === "instant" || (maintaining && state.scrollingTo?.isScrollToEnd)) {
        cancelImperativeScroll(state);
        syncScrollActive(ctx);
    }
    if (maintaining || state.pendingMaintainScrollAtEnd) {
        finishMaintainScrollAtEnd(ctx);
    }
}

// App native commands have no list request or drag owner. Hold rearming through their scroll events.
export function armAppScrollRearm(ctx: StateContext) {
    ctx.state.scheduledWork.timeout(
        () => rearmEndFollowIfSettled(ctx),
        USER_MOMENTUM_STALL_TIMEOUT_MS,
        "appScrollRearm",
    );
}

// A release baseline owns gesture deferral; momentum without one rearms from geometry.
export function rearmEndFollowIfSettled(ctx: StateContext) {
    const { state } = ctx;
    if (
        state.endFollowInterrupted &&
        (!state.visibleContentAnchor || state.visibleContentAnchor.sizeOnly) &&
        !state.isDragging &&
        state.userScrollContentSize === undefined &&
        !state.scheduledWork.has("appScrollRearm") &&
        !state.scrollingTo &&
        !state.pendingScrollResolve &&
        peek$(ctx, "isWithinMaintainScrollAtEndThreshold")
    ) {
        state.endFollowInterrupted = false;
        // Retain settled intent if the next content measurement moves the end beyond the threshold.
        if (state.props.maintainScrollAtEnd) set$(ctx, "isFollowingEnd", true);
    }
}

export function finishMaintainScrollAtEnd(ctx: StateContext) {
    const { state } = ctx;
    const currentPadding = peek$(ctx, "alignItemsAtEndPadding") || 0;
    const nextPadding = getAlignItemsAtEndPadding(ctx);
    state.maintainingScrollAtEnd = undefined;
    state.pendingMaintainScrollAtEnd = false;
    // Only rendered rows can still deliver a late measurement for this follow.
    for (const key of state.pendingEndMeasurements ?? []) {
        if (!state.containerItemKeys.has(key)) state.pendingEndMeasurements!.delete(key);
    }
    if (currentPadding !== nextPadding) {
        set$(ctx, "alignItemsAtEndPadding", nextPadding);
        state.scrollForNextCalculateItemsInView = undefined;
        state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        const nextScroll = clampScrollOffset(ctx, state.scroll + nextPadding - currentPadding);
        // iOS clamps the native offset when the padding shrinks, before MVCP applies this adjustment.
        const nativeScroll = Platform.OS === "ios" ? clampScrollOffset(ctx, state.scroll) : state.scroll;
        state.scroll = nativeScroll;
        requestAdjust(ctx, nextScroll - nativeScroll);
    }
}
