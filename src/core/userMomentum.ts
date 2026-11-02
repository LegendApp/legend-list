import { EDGE_POSITION_EPSILON, USER_MOMENTUM_STALL_TIMEOUT_MS, USER_MOMENTUM_WAIT_TIMEOUT_MS } from "@/constants";
import { syncScrollActive } from "@/core/cancelImperativeScroll";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { rearmEndFollowIfSettled } from "@/core/finishMaintainScrollAtEnd";
import { getContentSize } from "@/state/getContentSize";
import { peek$, type StateContext, set$ } from "@/state/state";

export function armUserScrollSettle(ctx: StateContext) {
    ctx.state.scheduledWork.timeout(
        () => {
            const state = ctx.state;
            const quiet = state.isMomentumScrolling ? USER_MOMENTUM_STALL_TIMEOUT_MS : USER_MOMENTUM_WAIT_TIMEOUT_MS;
            if (Date.now() - (state.lastNativeScrollTime ?? 0) < quiet) armUserScrollSettle(ctx);
            else settleUserScroll(ctx);
        },
        USER_MOMENTUM_WAIT_TIMEOUT_MS,
        "endFollowRearm",
    );
}

export function settleUserScroll(ctx: StateContext) {
    const state = ctx.state;
    if (state.isDragging) return;
    state.scheduledWork.cancel("endFollowRearm");
    state.isMomentumScrolling = false;
    syncScrollActive(ctx);
    const baseline = state.userScrollContentSize;
    state.userScrollContentSize = undefined;
    if (baseline === undefined) {
        rearmEndFollowIfSettled(ctx);
        return;
    }
    if (
        state.scrollingTo ||
        state.pendingScrollResolve ||
        ctx.scrollRequestTracker?.isWaitingToRun() ||
        state.scheduledWork.has("appScrollRearm")
    )
        return;

    const contentSize = getContentSize(ctx);
    const distance = Math.max(0, contentSize - state.scroll - state.scrollLength);
    const credit = Math.max(0, contentSize - baseline);
    set$(
        ctx,
        "isWithinMaintainScrollAtEndThreshold",
        distance - credit <=
            Math.max(EDGE_POSITION_EPSILON, (state.props.maintainScrollAtEndThreshold ?? 0) * state.scrollLength),
    );
    state.endFollowInterrupted = true;
    set$(ctx, "isFollowingEnd", false);
    rearmEndFollowIfSettled(ctx);
    if (peek$(ctx, "isFollowingEnd") && credit > 0 && distance > EDGE_POSITION_EPSILON) doMaintainScrollAtEnd(ctx);
}
