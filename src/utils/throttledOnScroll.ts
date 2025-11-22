import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

import { useThrottleDebounce } from "@/hooks/useThrottleDebounce";

/**
 * Creates a throttled scroll event handler that respects the scrollEventThrottle interval.
 * This matches ScrollView's behavior where:
 * - scrollEventThrottle = 0 or undefined: No throttling (fires on every scroll event)
 * - scrollEventThrottle > 0: Throttles events to fire at most once per interval
 *
 * The implementation uses trailing edge throttling to ensure the last scroll event
 * is always fired, which is important for accurate final scroll position tracking.
 */
export function useThrottledOnScroll(
    originalHandler: (event: NativeSyntheticEvent<NativeScrollEvent>) => void,
    scrollEventThrottle: number,
): (event: NativeSyntheticEvent<NativeScrollEvent>) => void {
    const throttle = useThrottleDebounce("throttle");

    return (event: NativeSyntheticEvent<NativeScrollEvent>) =>
        throttle(originalHandler, scrollEventThrottle, { nativeEvent: event.nativeEvent });
}
