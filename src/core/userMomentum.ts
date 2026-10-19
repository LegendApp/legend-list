import { USER_MOMENTUM_STALL_TIMEOUT_MS } from "@/constants";
import { doMaintainScrollAtEnd, rearmEndFollowIfSettled } from "@/core/doMaintainScrollAtEnd";
import { getContentSize } from "@/state/getContentSize";
import { type StateContext, set$ } from "@/state/state";
import { checkAtBottom } from "@/utils/checkAtBottom";

// A timer this far late means the JS thread was blocked, not that scrolling
// stopped: scroll events queued behind the block may still be unprocessed.
const STALL_FIRE_LATE_TOLERANCE_MS = 100;
// Re-arming around blocked threads stays bounded. An app whose timers are
// permanently starved recovers the flick after this window instead of
// suspending end following forever.
const STALL_RECOVERY_CEILING_MS = USER_MOMENTUM_STALL_TIMEOUT_MS * 4;

/**
 * Native can begin user momentum and never deliver its end (Android can abort
 * the fling at an edge and drop the end event), which would suspend end
 * following forever. Real momentum keeps emitting scroll events until it
 * settles, so a stall check recovers a flick whose activity has stopped.
 */
export function armUserMomentumStallCheck(ctx: StateContext) {
    const dueTime = Date.now() + USER_MOMENTUM_STALL_TIMEOUT_MS;
    ctx.state.scheduledWork.timeout(
        () => checkUserMomentumStall(ctx, dueTime),
        USER_MOMENTUM_STALL_TIMEOUT_MS,
        "userMomentumStallCheck",
    );
}

function checkUserMomentumStall(ctx: StateContext, dueTime: number) {
    const state = ctx.state;
    if (!state.releasedFromUserDrag || !state.isMomentumScrolling) {
        return;
    }
    // Scroll activity and this check are both stamped in JS, so a blocked
    // thread makes a live flick look stalled. Finishing then resumes following
    // mid-flick and yanks the user's scroll. Re-arm instead: the queued
    // events process before the next check and refresh the activity stamp.
    // The ceiling spans consecutive late fires only, so a long genuine flick
    // keeps full protection if the thread blocks after it ends.
    if (Date.now() - dueTime >= STALL_FIRE_LATE_TOLERANCE_MS) {
        if (state.momentumStallFirstLateFireAt === undefined) {
            state.momentumStallFirstLateFireAt = Date.now();
        }
        if (Date.now() - state.momentumStallFirstLateFireAt < STALL_RECOVERY_CEILING_MS) {
            armUserMomentumStallCheck(ctx);
            return;
        }
    } else {
        state.momentumStallFirstLateFireAt = undefined;
    }
    if (Date.now() - (state.lastNativeScrollTime ?? 0) < USER_MOMENTUM_STALL_TIMEOUT_MS) {
        armUserMomentumStallCheck(ctx);
        return;
    }
    finishUserMomentum(ctx);
}

/**
 * Growth the deferred follow never got to serve: content appended while the
 * gesture cycle suspended following is the reader's own end intent, not a
 * user move away from the end, so settle-time eligibility credits it back and
 * measures the user's displacement from the end they were following instead
 * of letting streaming appends push that distance past the threshold.
 */
export function settleEndFollowingAfterGesture(ctx: StateContext) {
    const state = ctx.state;
    const didDeferMaintain = state.didDeferMaintainScrollAtEndForMomentum;
    state.didDeferMaintainScrollAtEndForMomentum = false;
    const suspendedContentSize = state.momentumSuspendContentSize;
    const wasCompensated = state.momentumSuspendCompensated;
    state.momentumSuspendContentSize = undefined;
    state.momentumSuspendCompensated = false;
    if (didDeferMaintain) {
        // MVCP-compensated growth is already served. Zero credit is conservative
        // when prepends and appends share a gesture cycle.
        const growthCredit =
            suspendedContentSize === undefined || wasCompensated
                ? 0
                : Math.max(0, getContentSize(ctx) - suspendedContentSize);
        // Recompute against the current content and final user offset,
        // rather than replaying the old end-follow intent unconditionally.
        checkAtBottom(ctx, undefined, undefined, { maintainScrollAtEndGrowthCredit: growthCredit });
    }
    rearmEndFollowIfSettled(ctx);
    if (didDeferMaintain) doMaintainScrollAtEnd(ctx);
}

export function finishUserMomentum(ctx: StateContext) {
    const state = ctx.state;
    state.scheduledWork.cancel("userMomentumStallCheck");
    state.isMomentumScrolling = false;
    set$(ctx, "isScrollActive", !!state.isDragging || !!state.scrollingTo || !!state.pendingScrollResolve);
    state.releasedFromUserDrag = false;
    state.momentumStallFirstLateFireAt = undefined;
    settleEndFollowingAfterGesture(ctx);
}
