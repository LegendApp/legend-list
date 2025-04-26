import * as React from "react";
import { useEffect, useReducer } from "react";
import { Text, View } from "react-native";
import { getContentSize, use$, useStateContext } from "./state";
import type { InternalState } from "./types";

const DebugRow = ({ children }: React.PropsWithChildren) => {
    return (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>{children}</View>
    );
};

export const DebugView = React.memo(function DebugView({ state }: { state: InternalState }) {
    const ctx = useStateContext();
    const totalSize = use$("totalSize") || 0;
    const totalSizeWithScrollAdjust = use$("totalSizeWithScrollAdjust") || 0;
    const scrollAdjust = use$("scrollAdjust") || 0;
    const rawScroll = use$("debugRawScroll") || 0;
    const scroll = use$("debugComputedScroll") || 0;
    const contentSize = getContentSize(ctx);
    const [, forceUpdate] = useReducer((x) => x + 1, 0);
    const numContainers = use$("numContainers");
    const numContainersPooled = use$("numContainersPooled");

    useInterval(() => {
        forceUpdate();
    }, 100);

    return (
        <View
            style={{
                position: "absolute",
                top: 0,
                right: 0,
                paddingLeft: 4,
                paddingBottom: 4,
                // height: 100,
                backgroundColor: "#FFFFFFCC",
                padding: 4,
                borderRadius: 4,
            }}
            pointerEvents="none"
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
                <Text>{String(state.isAtBottom)}</Text>
            </DebugRow>
            <Text />
            <DebugRow>
                <Text>ScrollAdjust:</Text>
                <Text>{scrollAdjust.toFixed(2)}</Text>
            </DebugRow>
            <DebugRow>
                <Text>TotalSizeReal: </Text>
                <Text>{totalSizeWithScrollAdjust.toFixed(2)}</Text>
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
