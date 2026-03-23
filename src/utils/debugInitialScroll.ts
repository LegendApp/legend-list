import { Platform } from "@/platform/Platform";

const DEBUG_INITIAL_SCROLL_ID = "android-initial-scroll-v1";
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
