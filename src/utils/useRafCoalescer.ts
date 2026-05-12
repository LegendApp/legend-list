import { useEffect, useMemo, useRef } from "react";

import { useLatestRef } from "@/hooks/useLatestRef";

// Coalesce repeated schedule calls into a single callback per animation frame.
// This keeps noisy DOM-driven updates from re-running work multiple times before the next paint.
export function useRafCoalescer(callback: () => void) {
    const callbackRef = useLatestRef(callback);
    const rafIdRef = useRef<number | undefined>(undefined);

    const coalescer = useMemo(
        () => ({
            cancel() {
                if (rafIdRef.current !== undefined) {
                    cancelAnimationFrame(rafIdRef.current);
                    rafIdRef.current = undefined;
                }
            },
            flush() {
                coalescer.cancel();
                callbackRef.current();
            },
            schedule() {
                if (rafIdRef.current !== undefined) {
                    return false;
                }

                const rafId = requestAnimationFrame(() => {
                    if (rafIdRef.current !== rafId) {
                        return;
                    }
                    rafIdRef.current = undefined;
                    callbackRef.current();
                });
                rafIdRef.current = rafId;

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
