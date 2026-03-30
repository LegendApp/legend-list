import { IS_DEV } from "@/utils/devEnvironment";

export const ENABLE_RUNTIME_DEBUG_LOGS = IS_DEV && false;

export function debugRuntimeLog(...args: Parameters<typeof console.log>) {
    if (ENABLE_RUNTIME_DEBUG_LOGS) {
        console.log(...args);
    }
}
