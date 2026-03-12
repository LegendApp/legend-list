import * as React from "react";
import { Animated, type LayoutChangeEvent, Platform, type StyleProp, View, type ViewStyle } from "react-native";

import { POSITION_OUT_OF_VIEW } from "@/constants";
import { IsNewArchitecture } from "@/constants-platform";
import { useValue$ } from "@/hooks/useValue$";
import { useArr$, useStateContext } from "@/state/state";
import { type StickyHeaderConfig, typedMemo } from "@/types";
import { IS_DEV } from "@/utils/devEnvironment";
import { getComponent } from "@/utils/getComponent";

function useDeferredPositionCommitLog(params: { itemKey: string | undefined; phase: string; position: number }) {
    const { itemKey, phase, position } = params;
    const ctx = useStateContext();
    const visualProbeSeq = ctx.state.deferredPositionDebugVisualProbe?.seq;
    const mvcpProbeSeq = ctx.state.mvcpDebugVisualProbe?.seq;
    const lastLoggedRef = React.useRef<Record<string, number | undefined>>({});

    React.useLayoutEffect(() => {
        if (!IS_DEV) {
            return;
        }

        const logKey = (kind: "rebase" | "mvcp", seq: number) => `${kind}:${seq}:${itemKey ?? "undefined"}:${phase}`;
        const rebaseProbe = ctx.state.deferredPositionDebugVisualProbe;
        if (rebaseProbe && Date.now() - rebaseProbe.createdAt <= 1000) {
            const key = logKey("rebase", rebaseProbe.seq);
            if (lastLoggedRef.current[key] !== position) {
                lastLoggedRef.current[key] = position;
                console.log("[legend-list][deferred-position] position-commit", {
                    anchorContainerPositionAfter: rebaseProbe.anchorContainerPositionAfter,
                    anchorContainerPositionBefore: rebaseProbe.anchorContainerPositionBefore,
                    anchorId: rebaseProbe.anchorId,
                    itemKey,
                    kind: "rebase",
                    phase,
                    position,
                    reason: rebaseProbe.reason,
                    scrollAdjustAfter: rebaseProbe.scrollAdjustAfter,
                    scrollAdjustAfterExpected: rebaseProbe.scrollAdjustAfterExpected,
                    scrollAdjustBefore: rebaseProbe.scrollAdjustBefore,
                    seq: rebaseProbe.seq,
                });
            }
        }

        const mvcpProbe = ctx.state.mvcpDebugVisualProbe;
        if (mvcpProbe && Date.now() - mvcpProbe.createdAt <= 1000) {
            const key = logKey("mvcp", mvcpProbe.seq);
            if (lastLoggedRef.current[key] !== position) {
                lastLoggedRef.current[key] = position;
                console.log("[legend-list][deferred-position] position-commit", {
                    anchorId: mvcpProbe.anchorId,
                    itemKey,
                    kind: "mvcp",
                    mode: mvcpProbe.mode,
                    newPosition: mvcpProbe.newPosition,
                    phase,
                    position,
                    positionDiff: mvcpProbe.positionDiff,
                    reason: mvcpProbe.reason,
                    scrollAdjustAfterExpected: mvcpProbe.scrollAdjustAfterExpected,
                    scrollAdjustBefore: mvcpProbe.scrollAdjustBefore,
                    seq: mvcpProbe.seq,
                });
            }
        }
    }, [ctx, itemKey, mvcpProbeSeq, phase, position, visualProbeSeq]);
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const PositionViewState = typedMemo(function PositionViewState({
    id,
    horizontal,
    style,
    refView,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: StyleProp<ViewStyle>;
    refView: React.RefObject<View>;
    onLayout: (event: LayoutChangeEvent) => void;
    children: React.ReactNode;
}) {
    const [position = POSITION_OUT_OF_VIEW, itemKey] = useArr$([`containerPosition${id}`, `containerItemKey${id}`]);
    useDeferredPositionCommitLog({ itemKey, phase: "state", position });
    return (
        <View
            ref={refView}
            style={[
                style,
                horizontal ? { transform: [{ translateX: position }] } : { transform: [{ translateY: position }] },
            ]}
            {...rest}
        />
    );
});

// The Animated version is better on old arch but worse on new arch.
// And we don't want to use on new arch because it would make position updates
// not synchronous with the rest of the state updates.
// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const PositionViewAnimated = typedMemo(function PositionViewAnimated({
    id,
    horizontal,
    style,
    refView,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: StyleProp<ViewStyle>;
    refView: React.RefObject<View>;
    onLayout: (event: LayoutChangeEvent) => void;
    children: React.ReactNode;
}) {
    const [positionForLog = POSITION_OUT_OF_VIEW, itemKey] = useArr$([`containerPosition${id}`, `containerItemKey${id}`]);
    const position$ = useValue$(`containerPosition${id}`, {
        getValue: (v) => v ?? POSITION_OUT_OF_VIEW,
    });
    useDeferredPositionCommitLog({ itemKey, phase: "animated", position: positionForLog });

    let position:
        | { transform: Array<{ translateX: Animated.Value }> }
        | { transform: Array<{ translateY: Animated.Value }> }
        | { left: Animated.Value }
        | { top: Animated.Value };

    if (Platform.OS === "ios" || Platform.OS === "android") {
        position = horizontal ? { transform: [{ translateX: position$ }] } : { transform: [{ translateY: position$ }] };
    } else {
        // react-native-macos seems to not work well with transform here
        position = horizontal ? { left: position$ } : { top: position$ };
    }

    return <Animated.View ref={refView} style={[style, position]} {...rest} />;
});

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const PositionViewSticky = typedMemo(function PositionViewSticky({
    id,
    horizontal,
    style,
    refView,
    animatedScrollY,
    index,
    stickyHeaderConfig,
    children,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    style: StyleProp<ViewStyle>;
    refView: React.RefObject<View>;
    animatedScrollY?: Animated.Value;
    onLayout: (event: LayoutChangeEvent) => void;
    index: number;
    stickyHeaderConfig?: StickyHeaderConfig;
    children: React.ReactNode;
}) {
    const [position = POSITION_OUT_OF_VIEW, itemKey, headerSize = 0, stylePaddingTop = 0] = useArr$([
        `containerPosition${id}`,
        `containerItemKey${id}`,
        "headerSize",
        "stylePaddingTop",
    ]);
    useDeferredPositionCommitLog({ itemKey, phase: "sticky", position });

    // Calculate transform based on sticky state
    const transform = React.useMemo(() => {
        if (animatedScrollY) {
            const stickyConfigOffset = stickyHeaderConfig?.offset ?? 0;
            const stickyStart = position + headerSize + stylePaddingTop - stickyConfigOffset;
            const stickyPosition = animatedScrollY.interpolate({
                extrapolateLeft: "clamp",
                extrapolateRight: "extend",
                inputRange: [stickyStart, stickyStart + 5000],
                outputRange: [position, position + 5000],
            });

            return horizontal ? [{ translateX: stickyPosition }] : [{ translateY: stickyPosition }];
        }
    }, [animatedScrollY, headerSize, horizontal, position, stylePaddingTop, stickyHeaderConfig?.offset]);

    const viewStyle = React.useMemo(() => [style, { zIndex: index + 1000 }, { transform }], [style, transform]);

    const renderStickyHeaderBackdrop = React.useMemo(() => {
        if (!stickyHeaderConfig?.backdropComponent) {
            return null;
        }

        return (
            <View
                style={{
                    inset: 0,
                    pointerEvents: "none",
                    position: "absolute",
                }}
            >
                {getComponent(stickyHeaderConfig?.backdropComponent)}
            </View>
        );
    }, [stickyHeaderConfig?.backdropComponent]);

    return (
        <Animated.View ref={refView} style={viewStyle} {...rest}>
            {renderStickyHeaderBackdrop}
            {children}
        </Animated.View>
    );
});

export const PositionView = IsNewArchitecture ? PositionViewState : PositionViewAnimated;
export { PositionViewSticky };
