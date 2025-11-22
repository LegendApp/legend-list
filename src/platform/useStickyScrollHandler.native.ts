import { useMemo } from "react";
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

import type { StateContext } from "@/state/state";

export function useStickyScrollHandler(
    stickyHeaderIndices: number[] | undefined,
    horizontal: boolean,
    ctx: StateContext,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void,
) {
    // Create dual scroll handlers - one for native animations, one for JS logic
    return useMemo<typeof onScroll>(() => {
        if (stickyHeaderIndices?.length) {
            const { animatedScrollY } = ctx;
            return Animated.event(
                [
                    {
                        nativeEvent: {
                            contentOffset: { [horizontal ? "x" : "y"]: animatedScrollY as unknown as Animated.Value },
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
    }, [stickyHeaderIndices?.join(","), horizontal]);
}
