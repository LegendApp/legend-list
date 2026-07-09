import { addTotalSize } from "@/core/addTotalSize";
import { getDataLength } from "@/core/IndexedData";
import { syncLayoutStoreState } from "@/core/layoutStoreLifecycle";
import type { StateContext } from "@/state/state";

export function updateTotalSize(ctx: StateContext) {
    if (!ctx.state.props.dataSource && !ctx.state.props.data) {
        throw new TypeError("LegendList data is unavailable");
    }
    if (getDataLength(ctx.state) === 0) {
        addTotalSize(ctx, null, 0);
    } else {
        syncLayoutStoreState(ctx);
    }
}
