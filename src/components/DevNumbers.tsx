import * as React from "react";

import { IS_DEV } from "@/utils/devEnvironment";

export function DevNumbers(): React.ReactElement {
    return (IS_DEV &&
        React.memo(function DevNumbers() {
            return Array.from({ length: 100 }).map((_, index) => (
                <div
                    key={index}
                    style={{
                        height: 100,
                        pointerEvents: "none",
                        position: "absolute",
                        top: index * 100,
                        width: "100%",
                    }}
                >
                    <div style={{ color: "red" }}>{index * 100}</div>
                </div>
            ));
        })) as unknown as React.ReactElement;
}
