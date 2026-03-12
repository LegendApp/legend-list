import type * as React from "react";
import { View } from "react-native";

import { useArr$ } from "@/state/state";
import { getSharedNativeContentAdjust } from "@/utils/getContainerPositionValue";

export function ContentAdjust({ children, horizontal }: { children: React.ReactNode; horizontal: boolean }) {
    const [deferredPositionVisualAdjust = 0, scrollAdjustPending = 0] = useArr$([
        "deferredPositionVisualAdjust",
        "scrollAdjustPending",
    ]);
    const adjust = getSharedNativeContentAdjust({
        deferredPositionVisualAdjust,
        scrollAdjustPending,
    });

    return (
        <View style={horizontal ? { transform: [{ translateX: adjust }] } : { transform: [{ translateY: adjust }] }}>
            {children}
        </View>
    );
}
