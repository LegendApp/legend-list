import type { InternalState } from "@/types.base";
import { IS_DEV } from "@/utils/devEnvironment";

const DEBUG_OVERLAY_WINDOW_MS = 5000;

type DebugOverlayEvent = {
    at: number;
    id: number;
};

type DebugOverlayEventKind = "containerRenders" | "positionViewCommits";

type DebugOverlayHistory = Record<DebugOverlayEventKind, DebugOverlayEvent[]>;

export type DebugOverlayStatsSnapshot = {
    containerRenders: number;
    hottestContainerId?: number;
    hottestContainerRenders: number;
    hottestPositionViewCommits: number;
    hottestPositionViewId?: number;
    positionViewCommits: number;
    uniqueContainers: number;
    uniquePositionViews: number;
    windowMs: number;
};

const debugOverlayHistory = new WeakMap<InternalState, DebugOverlayHistory>();

function getHistory(state: InternalState): DebugOverlayHistory {
    let history = debugOverlayHistory.get(state);
    if (!history) {
        history = {
            containerRenders: [],
            positionViewCommits: [],
        };
        debugOverlayHistory.set(state, history);
    }
    return history;
}

function pruneEvents(events: DebugOverlayEvent[], now: number) {
    while (events.length > 0 && now - events[0]!.at > DEBUG_OVERLAY_WINDOW_MS) {
        events.shift();
    }
}

function summarize(events: DebugOverlayEvent[]) {
    const counts = new Map<number, number>();
    let hottestCount = 0;
    let hottestId: number | undefined;

    for (const event of events) {
        const next = (counts.get(event.id) ?? 0) + 1;
        counts.set(event.id, next);
        if (next > hottestCount) {
            hottestCount = next;
            hottestId = event.id;
        }
    }

    return {
        count: events.length,
        hottestCount,
        hottestId,
        uniqueCount: counts.size,
    };
}

export function recordDebugOverlayEvent(
    state: InternalState,
    type: DebugOverlayEventKind,
    info: {
        id: number;
    },
) {
    if (!IS_DEV || !state.debugOverlayEnabled) {
        return;
    }

    const now = Date.now();
    const events = getHistory(state)[type];
    pruneEvents(events, now);
    events.push({ at: now, id: info.id });
}

export function getDebugOverlayStatsSnapshot(state: InternalState): DebugOverlayStatsSnapshot {
    if (!IS_DEV || !state.debugOverlayEnabled) {
        return {
            containerRenders: 0,
            hottestContainerRenders: 0,
            hottestPositionViewCommits: 0,
            positionViewCommits: 0,
            uniqueContainers: 0,
            uniquePositionViews: 0,
            windowMs: DEBUG_OVERLAY_WINDOW_MS,
        };
    }

    const now = Date.now();
    const history = getHistory(state);
    pruneEvents(history.containerRenders, now);
    pruneEvents(history.positionViewCommits, now);

    const containerSummary = summarize(history.containerRenders);
    const positionViewSummary = summarize(history.positionViewCommits);

    return {
        containerRenders: containerSummary.count,
        hottestContainerId: containerSummary.hottestId,
        hottestContainerRenders: containerSummary.hottestCount,
        hottestPositionViewCommits: positionViewSummary.hottestCount,
        hottestPositionViewId: positionViewSummary.hottestId,
        positionViewCommits: positionViewSummary.count,
        uniqueContainers: containerSummary.uniqueCount,
        uniquePositionViews: positionViewSummary.uniqueCount,
        windowMs: DEBUG_OVERLAY_WINDOW_MS,
    };
}
