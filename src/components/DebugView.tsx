import * as React from "react";
import { useEffect, useReducer } from "react";
import { Text, View } from "react-native";

import { getContentSize, useArr$, useStateContext } from "@/state/state";
import type { InternalState } from "@/types";

const DebugRow = ({ children }: React.PropsWithChildren) => {
    return (
        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>{children}</View>
    );
};

export const DebugView = React.memo(function DebugView({ state }: { state: InternalState }) {
    const ctx = useStateContext();

    const [totalSize = 0, scrollAdjust = 0, rawScroll = 0, scroll = 0, _numContainers = 0, _numContainersPooled = 0] =
        useArr$([
            "totalSize",
            "scrollAdjust",
            "debugRawScroll",
            "debugComputedScroll",
            "numContainers",
            "numContainersPooled",
        ]);

    const contentSize = getContentSize(ctx);
    const [, forceUpdate] = useReducer((x) => x + 1, 0);

    useInterval(() => {
        forceUpdate();
    }, 100);

    return (
        <View
            pointerEvents="none"
            style={{
                // height: 100,
                backgroundColor: "#FFFFFFCC",
                borderRadius: 4,
                padding: 4,
                paddingBottom: 4,
                paddingLeft: 4,
                position: "absolute",
                right: 0,
                top: 0,
            }}
        >
            <DebugRow>
                <Text>TotalSize:</Text>
                <Text>{totalSize.toFixed(2)}</Text>
            </DebugRow>
            <DebugRow>
                <Text>ContentSize:</Text>
                <Text>{contentSize.toFixed(2)}</Text>
            </DebugRow>
            <DebugRow>
                <Text>At end:</Text>
                <Text>{String(state.isAtEnd)}</Text>
            </DebugRow>
            <Text />
            <DebugRow>
                <Text>ScrollAdjust:</Text>
                <Text>{scrollAdjust.toFixed(2)}</Text>
            </DebugRow>
            <Text />
            <DebugRow>
                <Text>RawScroll: </Text>
                <Text>{rawScroll.toFixed(2)}</Text>
            </DebugRow>
            <DebugRow>
                <Text>ComputedScroll: </Text>
                <Text>{scroll.toFixed(2)}</Text>
            </DebugRow>
        </View>
    );
});

function useInterval(callback: () => void, delay: number) {
    useEffect(() => {
        const interval = setInterval(callback, delay);
        return () => clearInterval(interval);
    }, [delay]);
}
