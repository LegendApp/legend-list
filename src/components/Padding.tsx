// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";

import { useArr$ } from "@/state/state";

export function Padding() {
    const [paddingTop] = useArr$(["alignItemsPaddingTop"]);

    return <div style={{ paddingTop }} />;
}

export function PaddingDevMode() {
    const [paddingTop] = useArr$(["alignItemsPaddingTop"]);

    return (
        <>
            <div style={{ paddingTop }} />
            <div
                style={{
                    backgroundColor: "green",
                    height: paddingTop,
                    left: 0,
                    position: "absolute",
                    right: 0,
                    top: 0,
                }}
            />
        </>
    );
}
