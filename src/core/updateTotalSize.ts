import { addTotalSize } from "@/core/addTotalSize";
import { syncLayoutStoreState } from "@/core/layoutStoreLifecycle";
import type { StateContext } from "@/state/state";

export function updateTotalSize(ctx: StateContext) {
    if (ctx.state.props.data.length === 0) {
        addTotalSize(ctx, null, 0);
    } else {
        syncLayoutStoreState(ctx);
    }
}
