// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";
import { Animated } from "react-native";

import { useValue$ } from "@/hooks/useValue$";

export function Padding() {
    const animPaddingTop = useValue$("alignItemsPaddingTop", { delay: 0 });

    return <Animated.View style={{ paddingTop: animPaddingTop }} />;
}

export function PaddingDevMode() {
    const animPaddingTop = useValue$("alignItemsPaddingTop", { delay: 0 });

    return (
        <>
            <Animated.View style={{ paddingTop: animPaddingTop }} />
            <Animated.View
                style={{
                    backgroundColor: "green",
                    height: animPaddingTop,
                    left: 0,
                    position: "absolute",
                    right: 0,
                    top: 0,
                }}
            />
        </>
    );
}
