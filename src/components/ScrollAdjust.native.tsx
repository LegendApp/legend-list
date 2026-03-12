// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";
import { View } from "react-native";

import { useArr$, useStateContext } from "@/state/state";
import { IS_DEV } from "@/utils/devEnvironment";

export function ScrollAdjust() {
    const ctx = useStateContext();
    // Use a large bias to ensure this value never goes negative
    const bias = 10_000_000;
    const [scrollAdjust, scrollAdjustUserOffset] = useArr$(["scrollAdjust", "scrollAdjustUserOffset"]);
    const scrollOffset = (scrollAdjust || 0) + (scrollAdjustUserOffset || 0) + bias;
    const horizontal = false;
    const lastLoggedRef = React.useRef<Record<string, number | undefined>>({});
    const visualProbeSeq = ctx.state.deferredPositionDebugVisualProbe?.seq;
    const mvcpProbeSeq = ctx.state.mvcpDebugVisualProbe?.seq;

    React.useLayoutEffect(() => {
        if (!IS_DEV) {
            return;
        }

        const nextScrollAdjust = scrollAdjust || 0;
        const logKey = (kind: "rebase" | "mvcp", seq: number) => `${kind}:${seq}`;
        const rebaseProbe = ctx.state.deferredPositionDebugVisualProbe;
        if (rebaseProbe && Date.now() - rebaseProbe.createdAt <= 1000) {
            const key = logKey("rebase", rebaseProbe.seq);
            if (lastLoggedRef.current[key] !== nextScrollAdjust) {
                lastLoggedRef.current[key] = nextScrollAdjust;
                console.log("[legend-list][deferred-position] scroll-adjust-commit", {
                    anchorContainerPositionAfter: rebaseProbe.anchorContainerPositionAfter,
                    anchorContainerPositionBefore: rebaseProbe.anchorContainerPositionBefore,
                    anchorId: rebaseProbe.anchorId,
                    kind: "rebase",
                    reason: rebaseProbe.reason,
                    scrollAdjust: nextScrollAdjust,
                    scrollAdjustAfter: rebaseProbe.scrollAdjustAfter,
                    scrollAdjustAfterExpected: rebaseProbe.scrollAdjustAfterExpected,
                    scrollAdjustBefore: rebaseProbe.scrollAdjustBefore,
                    seq: rebaseProbe.seq,
                    userOffset: scrollAdjustUserOffset || 0,
                });
            }
        }

        const mvcpProbe = ctx.state.mvcpDebugVisualProbe;
        if (mvcpProbe && Date.now() - mvcpProbe.createdAt <= 1000) {
            const key = logKey("mvcp", mvcpProbe.seq);
            if (lastLoggedRef.current[key] !== nextScrollAdjust) {
                lastLoggedRef.current[key] = nextScrollAdjust;
                console.log("[legend-list][deferred-position] scroll-adjust-commit", {
                    anchorId: mvcpProbe.anchorId,
                    kind: "mvcp",
                    mode: mvcpProbe.mode,
                    newPosition: mvcpProbe.newPosition,
                    positionDiff: mvcpProbe.positionDiff,
                    reason: mvcpProbe.reason,
                    scrollAdjust: nextScrollAdjust,
                    scrollAdjustAfterExpected: mvcpProbe.scrollAdjustAfterExpected,
                    scrollAdjustBefore: mvcpProbe.scrollAdjustBefore,
                    seq: mvcpProbe.seq,
                    userOffset: scrollAdjustUserOffset || 0,
                });
            }
        }
    }, [ctx, mvcpProbeSeq, scrollAdjust, scrollAdjustUserOffset, visualProbeSeq]);

    return (
        <View
            style={{
                height: 0,
                left: horizontal ? scrollOffset : 0,
                position: "absolute",
                top: horizontal ? 0 : scrollOffset,
                width: 0,
            }}
        />
    );
}
