import { useEffect, useRef } from "react";

import { Platform } from "@/platform/Platform";
import { listen$, useStateContext } from "@/state/state";
import { sortDOMElementsPatience } from "@/utils/reordering";

export function useDOMOrder(ref: React.RefObject<HTMLDivElement>) {
    const ctx = useStateContext();
    const debounceRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (Platform.OS !== "web") {
            return;
        }

        const unsubscribe = listen$(ctx, "lastPositionUpdate", () => {
            // Clear existing timeout
            if (debounceRef.current !== undefined) {
                clearTimeout(debounceRef.current);
            }

            // Schedule reordering to run 500ms after the last position change
            debounceRef.current = setTimeout(() => {
                // Find the first container element from the viewRefs map and use its parent for reordering
                const parent = ref.current;
                if (parent) {
                    sortDOMElementsPatience(parent);
                }
                debounceRef.current = undefined;
            }, 500) as unknown as number;
        });

        return () => {
            unsubscribe();
            if (debounceRef.current !== undefined) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [ctx]);
}
