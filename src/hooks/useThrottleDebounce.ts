import { useCallback, useRef } from "react";

type Mode = "debounce" | "throttle";

export function useThrottleDebounce(mode: Mode) {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastCallTimeRef = useRef<number>(0);
    const lastArgsRef = useRef<any>(null);

    const clearTimeoutRef = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const execute = useCallback(
        (callback: (...args: any[]) => void, delay: number, ...args: any[]) => {
            if (mode === "debounce") {
                clearTimeoutRef();
                timeoutRef.current = setTimeout(() => callback(...args), delay);
            } else {
                const now = Date.now();
                lastArgsRef.current = args;

                if (now - lastCallTimeRef.current >= delay) {
                    lastCallTimeRef.current = now;
                    callback(...args);
                    clearTimeoutRef();
                } else {
                    clearTimeoutRef();
                    timeoutRef.current = setTimeout(
                        () => {
                            if (lastArgsRef.current) {
                                lastCallTimeRef.current = Date.now();
                                callback(...lastArgsRef.current);
                                timeoutRef.current = null;
                                lastArgsRef.current = null;
                            }
                        },
                        delay - (now - lastCallTimeRef.current),
                    );
                }
            }
        },
        [mode],
    );

    return execute;
}
