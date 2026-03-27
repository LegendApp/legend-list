import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

type DebugEntry = {
    event: string;
    payload?: Record<string, unknown>;
    seq: number;
    ts: number;
};

type DebugGlobal = typeof globalThis & {
    __LEGEND_LIST_DEBUG_INITIAL_SCROLL__?: boolean;
    __LEGEND_LIST_DEBUG_INITIAL_SCROLL_LOGS__?: DebugEntry[];
    __LEGEND_LIST_DEBUG_INITIAL_SCROLL_OVERLAY__?: boolean;
};

const POLL_MS = 250;
const MAX_LOG_LINES = 36;
const INCLUDED_EVENTS = new Set([
    "activate-initial-bootstrap",
    "dispatch-bootstrap-commit-scroll",
    "finish-initial-bootstrap",
    "queue-deferred-size-shift",
    "apply-pending-deferred-size-shift",
    "applied-pending-deferred-size-shift",
    "flush-deferred-position-for-cap",
    "request-deferred-position-flush",
    "schedule-deferred-position-flush",
    "run-deferred-position-flush",
    "rebase-deferred-position-state",
    "request-adjust",
    "apply-scroll-adjust",
]);

function getDebugGlobal(): DebugGlobal {
    return globalThis as DebugGlobal;
}

function formatPayload(payload?: Record<string, unknown>) {
    if (!payload) {
        return "";
    }

    return Object.entries(payload)
        .slice(0, 10)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(" ");
}

export function InitialScrollDebugOverlay() {
    const [entries, setEntries] = useState<DebugEntry[]>([]);
    const [isOverlayEnabled, setIsOverlayEnabled] = useState(false);

    useEffect(() => {
        const debugGlobal = getDebugGlobal();
        debugGlobal.__LEGEND_LIST_DEBUG_INITIAL_SCROLL__ = true;
        debugGlobal.__LEGEND_LIST_DEBUG_INITIAL_SCROLL_LOGS__ = [];

        const sync = () => {
            const logs = debugGlobal.__LEGEND_LIST_DEBUG_INITIAL_SCROLL_LOGS__ ?? [];
            setIsOverlayEnabled(debugGlobal.__LEGEND_LIST_DEBUG_INITIAL_SCROLL_OVERLAY__ === true);
            setEntries(logs.filter((entry) => INCLUDED_EVENTS.has(entry.event)).slice(-MAX_LOG_LINES));
        };

        sync();
        const timer = setInterval(sync, POLL_MS);
        return () => clearInterval(timer);
    }, []);

    if (!isOverlayEnabled || entries.length === 0) {
        return null;
    }

    return (
        <View pointerEvents="none" style={styles.container}>
            {entries.map((entry) => (
                <Text key={`${entry.ts}-${entry.seq}`} style={styles.text}>
                    {entry.seq}. {entry.event} {formatPayload(entry.payload)}
                </Text>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: "rgba(0, 0, 0, 0.82)",
        borderRadius: 10,
        left: 8,
        maxHeight: 520,
        paddingHorizontal: 8,
        paddingVertical: 6,
        position: "absolute",
        right: 8,
        top: 48,
        zIndex: 9999,
    },
    text: {
        color: "#9FF7C2",
        fontFamily: "Courier",
        fontSize: 10,
        lineHeight: 13,
    },
});
