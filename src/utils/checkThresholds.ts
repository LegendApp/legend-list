import { rearmEndFollowIfSettled } from "@/core/doMaintainScrollAtEnd";
import { emitMetrics } from "@/core/emitMetrics";
import type { StateContext } from "@/state/state";
import { checkAtBottom } from "@/utils/checkAtBottom";
import { checkAtTop } from "@/utils/checkAtTop";
import type { ReachedEdge } from "@/utils/edgeReachedGate";

export function checkThresholds(ctx: StateContext, allowedEdge?: ReachedEdge) {
    const allowGateCreatedInCurrentCheck = !ctx.state.edgeReachedGate;
    checkAtBottom(ctx, allowedEdge, allowGateCreatedInCurrentCheck);
    checkAtTop(ctx, allowedEdge, allowGateCreatedInCurrentCheck);
    rearmEndFollowIfSettled(ctx);
    emitMetrics(ctx);
}
