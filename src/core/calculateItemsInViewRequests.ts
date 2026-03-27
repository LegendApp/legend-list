import type { InternalState } from "@/types.base";

export function getDataChangeReconcileRequest() {
    return {
        dataChanged: true,
        doMVCP: true,
    } as const;
}

export function getLayoutReconcileRequest() {
    return {
        doMVCP: true,
    } as const;
}

export function getScrollUpdateRequest(state: Pick<InternalState, "scrollingTo">) {
    return {
        doMVCP: state.scrollingTo !== undefined,
    } as const;
}
