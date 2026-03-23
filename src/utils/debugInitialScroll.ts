import { Platform } from "@/platform/Platform";
import type { InternalState } from "@/types.base";

const DEBUG_INITIAL_SCROLL_ID = "android-initial-scroll-v2";
let debugInitialScrollSeq = 0;

export function debugInitialScroll(event: string, payload: Record<string, unknown>) {
    if (Platform.OS !== "android") {
        return;
    }

    console.log(`${Date.now()} [debug-log initial-scroll ${DEBUG_INITIAL_SCROLL_ID}] ${event}`, {
        seq: ++debugInitialScrollSeq,
        ...payload,
    });
}

export function shouldDebugInitialScrollState(
    state: Pick<
        InternalState,
        "didFinishInitialScroll" | "initialBootstrap" | "initialScroll" | "queuedInitialLayout" | "scrollingTo"
    >,
) {
    return !!(
        state.initialScroll ||
        state.initialBootstrap ||
        state.queuedInitialLayout ||
        state.scrollingTo?.isInitialScroll ||
        !state.didFinishInitialScroll
    );
}
