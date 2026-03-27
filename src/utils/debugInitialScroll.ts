import { IS_DEV } from "@/utils/devEnvironment";

const DEBUG_ID = "initial-scroll-v5";
const MAX_DEBUG_LOGS = 400;

export interface InitialScrollDebugEntry {
    event: string;
    payload?: Record<string, unknown>;
    seq: number;
    ts: number;
}

type DebugGlobal = typeof globalThis & {
    __LEGEND_LIST_DEBUG_INITIAL_SCROLL__?: boolean;
    __LEGEND_LIST_DEBUG_INITIAL_SCROLL_LOGS__?: InitialScrollDebugEntry[];
};

let seq = 0;

function getDebugGlobal(): DebugGlobal {
    return globalThis as DebugGlobal;
}

function shouldLogInitialScrollDebug() {
    const debugGlobal = getDebugGlobal();
    return IS_DEV && debugGlobal.__LEGEND_LIST_DEBUG_INITIAL_SCROLL__ !== false;
}

export function logInitialScrollDebug(event: string, payload?: Record<string, unknown>) {
    if (!shouldLogInitialScrollDebug()) {
        return;
    }

    const ts = Date.now();
    const entry: InitialScrollDebugEntry = {
        event,
        payload,
        seq: ++seq,
        ts,
    };

    const debugGlobal = getDebugGlobal();
    const logs = debugGlobal.__LEGEND_LIST_DEBUG_INITIAL_SCROLL_LOGS__ ?? [];
    logs.push(entry);
    if (logs.length > MAX_DEBUG_LOGS) {
        logs.splice(0, logs.length - MAX_DEBUG_LOGS);
    }
    debugGlobal.__LEGEND_LIST_DEBUG_INITIAL_SCROLL_LOGS__ = logs;

    console.log(`${ts} [debug-log legend-list ${DEBUG_ID}] ${event}`, {
        seq: entry.seq,
        ...payload,
    });
}

export function getInitialScrollDebugLogs() {
    return getDebugGlobal().__LEGEND_LIST_DEBUG_INITIAL_SCROLL_LOGS__ ?? [];
}

export function resetInitialScrollDebugLogs() {
    getDebugGlobal().__LEGEND_LIST_DEBUG_INITIAL_SCROLL_LOGS__ = [];
    seq = 0;
}
