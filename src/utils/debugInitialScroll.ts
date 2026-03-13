import { IS_DEV } from "@/utils/devEnvironment";

export function isInitialScrollTraceEnabled() {
    return IS_DEV;
}

export function debugInitialScroll(label: string, payload?: Record<string, unknown>) {
    if (!isInitialScrollTraceEnabled()) {
        return;
    }

    if (payload) {
        console.log(`[legend-list][initial-scroll] ${label}`, payload);
    } else {
        console.log(`[legend-list][initial-scroll] ${label}`);
    }
}
