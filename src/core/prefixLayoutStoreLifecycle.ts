import { PrefixLayoutStore } from "@/core/PrefixLayoutStore";
import type { StateContext } from "@/state/state";

const ENABLE_PREFIX_LAYOUT_STORE = true;

export function clearPrefixLayoutStoreMeasurements(ctx: StateContext) {
    ctx.state.layoutStore?.clearMeasurements();
}

export function getActivePrefixLayoutStore(ctx: StateContext) {
    let store: PrefixLayoutStore | undefined;
    if (isPrefixLayoutStoreSupported(ctx)) {
        store = ctx.state.layoutStore;
    }
    return store;
}

export function isPrefixLayoutStoreSupported(ctx: StateContext) {
    const state = ctx.state;
    const {
        props: { horizontal, numColumns, overrideItemLayout, positionComponentInternal, snapToIndices },
    } = state;

    return (
        ENABLE_PREFIX_LAYOUT_STORE &&
        !horizontal &&
        numColumns === 1 &&
        !overrideItemLayout &&
        !snapToIndices?.length &&
        !positionComponentInternal &&
        ctx.positionListeners.size === 0
    );
}

export function syncPrefixLayoutStore(ctx: StateContext) {
    const state = ctx.state;
    if (isPrefixLayoutStoreSupported(ctx)) {
        const estimatedSize = getPrefixLayoutStoreEstimatedSize(ctx);
        if (state.layoutStore) {
            state.layoutStore.resize(state.props.data.length);
            state.layoutStore.flushEstimatedSize(estimatedSize);
        } else {
            state.layoutStore = new PrefixLayoutStore(state.props.data.length, estimatedSize);
        }
    } else {
        state.layoutStore = undefined;
    }

    return state.layoutStore;
}

function getPrefixLayoutStoreEstimatedSize(ctx: StateContext) {
    return (ctx.state.props.estimatedItemSize ?? 100) + ctx.scrollAxisGap;
}
