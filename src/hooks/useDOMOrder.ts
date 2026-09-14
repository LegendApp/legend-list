import { type RefObject, useEffect } from "react";

import { Platform } from "@/platform/Platform";
import { listen$, peek$, useStateContext } from "@/state/state";
import { sortDOMElements } from "@/utils/reordering";

export function useDOMOrder(ref: RefObject<HTMLDivElement | null>) {
    const ctx = useStateContext();

    useEffect(() => {
        if (Platform.OS !== "web") {
            return;
        }

        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        let lastUpdateTime = 0;
        let delay = 500;

        const unsubscribe = listen$(ctx, "lastPositionUpdate", () => {
            const container = ref.current;
            const now = Date.now();
            // Keep an immediate batch immediate. A 1s quiet period avoids jitter
            // around the 500ms debounce boundary turning bursts into eager work.
            delay =
                container &&
                "moveBefore" in container &&
                typeof container.moveBefore === "function" &&
                container.isConnected &&
                (now - lastUpdateTime >= 1000 || (timeoutId !== undefined && delay === 0)) &&
                now - ctx.state.scrollTime >= 500
                    ? 0
                    : 500;
            lastUpdateTime = now;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                timeoutId = undefined;
                const parent = ref.current;
                if (parent) {
                    const indexByElement = new Map<HTMLElement, number>();
                    for (const [containerId, viewRef] of ctx.viewRefs) {
                        const element = viewRef.current as HTMLElement | null;
                        const index = peek$(ctx, `containerItemIndex${containerId}`);
                        if (element && index !== undefined) {
                            indexByElement.set(element, index);
                        }
                    }
                    sortDOMElements(parent, indexByElement);
                }
            }, delay);
        });

        return () => {
            unsubscribe();
            clearTimeout(timeoutId);
        };
    }, [ctx]);
}
