import { useMemo } from "react";
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

import type { StateContext } from "@/state/state";

export function useStickyScrollHandler(
    stickyIndices: number[] | undefined,
    horizontal: boolean,
    ctx: StateContext,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void,
) {
    return useMemo<typeof onScroll>(() => {
        if (stickyIndices?.length) {
            const { animatedScrollY } = ctx;
            return Animated.event([{ nativeEvent: { contentOffset: { [horizontal ? "x" : "y"]: animatedScrollY } } }], {
                listener: onScroll,
                useNativeDriver: true,
            });
        }
        return onScroll;
    }, [stickyIndices?.join(","), horizontal]);
}
