import { useMemo, useRef } from "react";
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

import type { StateContext } from "@/state/state";
import { isHorizontalRTL } from "@/utils/rtl";

export function useStickyScrollHandler(
    stickyHeaderIndices: number[] | undefined,
    horizontal: boolean,
    ctx: StateContext,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void,
) {
    const shouldUseRnAnimatedEngine = !ctx.state.props.stickyPositionComponentInternal;
    const isAnimatedEngineActive = !!stickyHeaderIndices?.length && shouldUseRnAnimatedEngine;
    const wasAnimatedEngineActive = useRef(false);

    // Create dual scroll handlers - one for native animations, one for JS logic
    return useMemo<typeof onScroll>(() => {
        const wasActive = wasAnimatedEngineActive.current;
        wasAnimatedEngineActive.current = isAnimatedEngineActive;

        if (isAnimatedEngineActive) {
            const animatedScrollY = ctx.animatedScrollY as unknown as Animated.Value;
            if (!wasActive) {
                // Animated.event is the only writer of animatedScrollY, so any scroll that happened
                // before it attached was never recorded - most notably the rest offset iOS reports at
                // mount for contentInsetAdjustmentBehavior="automatic". Seed the value from the
                // JS-tracked native offset so sticky headers paint in the right place immediately
                // instead of staying stuck at 0 until the next scroll event. lastNativeScroll matches
                // the raw contentOffset that Animated.event writes, except on RTL horizontal lists
                // where it has been converted to a logical offset.
                const { lastNativeScroll } = ctx.state;
                if (
                    typeof lastNativeScroll === "number" &&
                    Number.isFinite(lastNativeScroll) &&
                    !isHorizontalRTL(ctx.state)
                ) {
                    animatedScrollY.setValue(lastNativeScroll);
                }
            }
            return Animated.event(
                [
                    {
                        nativeEvent: {
                            contentOffset: { [horizontal ? "x" : "y"]: animatedScrollY },
                        },
                    },
                ],
                {
                    listener: onScroll,
                    useNativeDriver: true,
                },
            );
        }
        return onScroll;
    }, [stickyHeaderIndices?.join(","), horizontal, shouldUseRnAnimatedEngine]);
}
