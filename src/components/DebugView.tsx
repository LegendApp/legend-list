import * as React from "react";
import { useEffect, useReducer } from "react";

import { Text, View } from "@/platform/ViewComponents";
import { getContentSize } from "@/state/getContentSize";
import { useArr$, useStateContext } from "@/state/state";
import type { InternalState } from "@/types.base";
import { getDebugOverlayStatsSnapshot } from "@/utils/debugOverlayStats";

const DebugRow = ({ children }: React.PropsWithChildren) => {
    return (
        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>{children}</View>
    );
};

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const DebugView = React.memo(function DebugView({ state }: { state: InternalState }) {
    const ctx = useStateContext();

    const [
        totalSize = 0,
        scrollAdjust = 0,
        scrollAdjustPending = 0,
        rawScroll = 0,
        scroll = 0,
        numContainers = 0,
        numContainersPooled = 0,
    ] = useArr$([
        "totalSize",
        "scrollAdjust",
        "scrollAdjustPending",
        "debugRawScroll",
        "debugComputedScroll",
        "numContainers",
        "numContainersPooled",
    ]);

    const contentSize = getContentSize(ctx);
    const [, forceUpdate] = useReducer((x) => x + 1, 0);
    const stats = getDebugOverlayStatsSnapshot(state);
    const hasDeferred = !!state.deferredPositions;
    const hasActiveMVCPAnchorLock =
        !!state.mvcpAnchorLock &&
        Date.now() <= state.mvcpAnchorLock.expiresAt &&
        !!state.indexByKey.get(state.mvcpAnchorLock.id);
    const hasMVCP = state.dataChangeNeedsScrollUpdate || hasActiveMVCPAnchorLock;

    const mode = hasDeferred && hasMVCP ? "deferred + mvcp" : hasDeferred ? "deferred" : hasMVCP ? "mvcp" : "idle";
    const rangeText =
        state.startNoBuffer >= 0
            ? `${state.startNoBuffer}-${state.endNoBuffer} (${state.startBuffered}-${state.endBuffered})`
            : "-";
    const anchorText = hasDeferred
        ? `${state.deferredPositions?.anchorKey ?? "-"} d=${(state.deferredPositions?.drift ?? 0).toFixed(1)}`
        : hasActiveMVCPAnchorLock
          ? `${state.mvcpAnchorLock?.id ?? "-"} q=${state.mvcpAnchorLock?.quietPasses ?? 0}`
          : "-";
    const hottestText =
        stats.hottestContainerId === undefined && stats.hottestPositionViewId === undefined
            ? "-"
            : `c${stats.hottestContainerId ?? "-"} x${stats.hottestContainerRenders} | p${stats.hottestPositionViewId ?? "-"} x${stats.hottestPositionViewCommits}`;

    useInterval(() => {
        forceUpdate();
    }, 250);

    return (
        <View
            pointerEvents="none"
            style={{
                backgroundColor: "#0B1020D9",
                borderColor: "#7DD3FC",
                borderRadius: 8,
                borderWidth: 1,
                maxWidth: 320,
                padding: 8,
                position: "absolute",
                right: 8,
                top: 60,
            }}
        >
            <DebugRow>
                <Text style={{ color: "#BFDBFE", fontWeight: "700" }}>Mode</Text>
                <Text style={{ color: "#F8FAFC" }}>{mode}</Text>
            </DebugRow>
            <DebugRow>
                <Text style={{ color: "#BFDBFE" }}>Containers {stats.windowMs / 1000}s</Text>
                <Text style={{ color: "#F8FAFC" }}>
                    {stats.containerRenders} ({stats.uniqueContainers} ids)
                </Text>
            </DebugRow>
            <DebugRow>
                <Text style={{ color: "#BFDBFE" }}>PositionViews {stats.windowMs / 1000}s</Text>
                <Text style={{ color: "#F8FAFC" }}>
                    {stats.positionViewCommits} ({stats.uniquePositionViews} ids)
                </Text>
            </DebugRow>
            <DebugRow>
                <Text style={{ color: "#BFDBFE" }}>Hot IDs</Text>
                <Text style={{ color: "#F8FAFC" }}>{hottestText}</Text>
            </DebugRow>
            <DebugRow>
                <Text style={{ color: "#BFDBFE" }}>Range</Text>
                <Text style={{ color: "#F8FAFC" }}>{rangeText}</Text>
            </DebugRow>
            <DebugRow>
                <Text style={{ color: "#BFDBFE" }}>Anchor</Text>
                <Text style={{ color: "#F8FAFC" }}>{anchorText}</Text>
            </DebugRow>
            <DebugRow>
                <Text style={{ color: "#BFDBFE" }}>Pool</Text>
                <Text style={{ color: "#F8FAFC" }}>
                    {numContainers}/{numContainersPooled}
                </Text>
            </DebugRow>
            <DebugRow>
                <Text style={{ color: "#BFDBFE" }}>Adjust</Text>
                <Text style={{ color: "#F8FAFC" }}>
                    {scrollAdjust.toFixed(1)} p={scrollAdjustPending.toFixed(1)}
                </Text>
            </DebugRow>
            <DebugRow>
                <Text style={{ color: "#BFDBFE" }}>Scroll</Text>
                <Text style={{ color: "#F8FAFC" }}>
                    {scroll.toFixed(1)} raw={rawScroll.toFixed(1)}
                </Text>
            </DebugRow>
            <DebugRow>
                <Text style={{ color: "#BFDBFE" }}>Size</Text>
                <Text style={{ color: "#F8FAFC" }}>
                    {contentSize.toFixed(1)}/{totalSize.toFixed(1)}
                </Text>
            </DebugRow>
            <DebugRow>
                <Text style={{ color: "#BFDBFE" }}>At End</Text>
                <Text style={{ color: "#F8FAFC" }}>{String(state.isAtEnd)}</Text>
            </DebugRow>
        </View>
    );
});

function useInterval(callback: () => void, delay: number) {
    const callbackRef = React.useRef(callback);

    callbackRef.current = callback;

    useEffect(() => {
        const interval = setInterval(() => callbackRef.current(), delay);
        return () => clearInterval(interval);
    }, [delay]);
}
