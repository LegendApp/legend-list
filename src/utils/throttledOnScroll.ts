import { useLayoutEffect, useRef } from "react";

import type { NativeScrollEvent, NativeSyntheticEvent } from "@/platform/scrollview-types";

type ScrollHandler = (event: NativeSyntheticEvent<NativeScrollEvent>) => void;

/** Throttles onScroll and delivers the most recent scroll event at the end of the interval. */
export function useThrottledOnScroll(onScroll: ScrollHandler | undefined, interval: number): ScrollHandler | undefined {
    const lastCallTime = useRef(0);
    const pending = useRef<{
        callback: ScrollHandler;
        interval: number;
        nativeEvent: NativeScrollEvent;
        timer: ReturnType<typeof setTimeout>;
    }>(undefined);

    const enabled = !!onScroll && !!interval;
    useLayoutEffect(() => {
        if (!enabled) return;
        return () => {
            const call = pending.current;
            if (call) {
                clearTimeout(call.timer);
                pending.current = undefined;
            }
        };
    }, [enabled]);

    if (!enabled) return onScroll;

    return ({ nativeEvent }) => {
        const now = Date.now();
        const remaining = interval - (now - lastCallTime.current);
        const previous = pending.current;

        if (remaining > 0 && previous?.interval === interval) {
            previous.callback = onScroll;
            previous.nativeEvent = nativeEvent;
            return;
        }

        if (previous) {
            clearTimeout(previous.timer);
            pending.current = undefined;
        }
        if (remaining <= 0) {
            lastCallTime.current = now;
            onScroll({ nativeEvent });
            return;
        }

        pending.current = {
            callback: onScroll,
            interval,
            nativeEvent,
            timer: setTimeout(() => {
                const call = pending.current!;
                pending.current = undefined;
                lastCallTime.current = Date.now();
                call.callback({ nativeEvent: call.nativeEvent });
            }, remaining),
        };
    };
}
