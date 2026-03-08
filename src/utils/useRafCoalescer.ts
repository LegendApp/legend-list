import { useEffect, useMemo, useRef } from "react";

// Coalesce repeated schedule calls into a single callback per animation frame.
// This keeps noisy DOM-driven updates from re-running work multiple times before the next paint.
export function useRafCoalescer(callback: () => void) {
    const callbackRef = useRef(callback);
    const rafIdRef = useRef<number | undefined>(undefined);

    callbackRef.current = callback;

    const coalescer = useMemo(
        () => ({
            cancel() {
                if (rafIdRef.current !== undefined) {
                    cancelAnimationFrame(rafIdRef.current);
                    rafIdRef.current = undefined;
                }
            },
            schedule() {
                if (rafIdRef.current !== undefined) {
                    return false;
                }

                rafIdRef.current = requestAnimationFrame(() => {
                    rafIdRef.current = undefined;
                    callbackRef.current();
                });

                return true;
            },
        }),
        [],
    );

    useEffect(
        () => () => {
            coalescer.cancel();
        },
        [coalescer],
    );

    return coalescer;
}
