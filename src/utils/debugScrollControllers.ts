import { IS_DEV } from "@/utils/devEnvironment";

const DEBUG_SCROLL_CONTROLLERS_KEY = "__LEGEND_LIST_DEBUG_SCROLL_CONTROLLERS__";

type ScrollControllerDebugConfig = boolean | { enabled?: boolean };

function isTruthyFlag(value: unknown) {
    return value === true || value === "1" || value === "true";
}

function isFalsyFlag(value: unknown) {
    return value === false || value === "0" || value === "false";
}

function isDebugScrollControllersEnabled() {
    if (!IS_DEV) {
        return false;
    }

    const globalConfig = (globalThis as unknown as Record<string, unknown>)[DEBUG_SCROLL_CONTROLLERS_KEY] as
        | ScrollControllerDebugConfig
        | undefined;
    if (typeof globalConfig === "object" && globalConfig) {
        return globalConfig.enabled !== false;
    }
    if (typeof globalConfig === "boolean") {
        return globalConfig;
    }

    const envValue =
        typeof process !== "undefined" && typeof process.env === "object" && process.env
            ? process.env.LEGEND_LIST_DEBUG_SCROLL_CONTROLLERS
            : undefined;
    if (isFalsyFlag(envValue)) {
        return false;
    }
    if (isTruthyFlag(envValue)) {
        return true;
    }

    return true;
}

export function logScrollControllerDebug(event: string, payload?: Record<string, unknown>) {
    if (!isDebugScrollControllersEnabled()) {
        return;
    }

    if (payload) {
        console.log(`[legend-list][scroll-debug] ${event}`, payload);
        return;
    }

    console.log(`[legend-list][scroll-debug] ${event}`);
}
