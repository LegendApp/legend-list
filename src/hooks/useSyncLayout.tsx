import { useCallback, useLayoutEffect } from "react";

import type { LayoutChangeEvent, LayoutRectangle } from "@/platform/Layout";
import type { WebViewMethods } from "@/platform/View";
import { useResizeObserver } from "./useResizeObserver";

export function useSyncLayout<T extends HTMLDivElement = HTMLDivElement>({
    ref,
    onLayoutChange,
}: {
    ref: React.RefObject<T>;
    onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
}): { onLayout?: (event: LayoutChangeEvent) => void } {
    useResizeObserver(
        ref.current,
        useCallback(
            (entry) => {
                onLayoutChange(entry.contentRect, false);
            },
            [onLayoutChange],
        ),
    );

    useLayoutEffect(() => {
        if (ref.current) {
            const rect = ref.current.getBoundingClientRect();
            onLayoutChange(
                {
                    height: rect.height,
                    width: rect.width,
                    x: rect.left,
                    y: rect.top,
                },
                true,
            );
        }
    }, []);

    return {};
}
