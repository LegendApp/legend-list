import { useCallback, useLayoutEffect } from "react";
import type { LayoutChangeEvent, View } from "react-native";

import type { ScrollViewMethods } from "@/components/ListComponentScrollView";
import type { LayoutRectangle } from "@/platform/platform-types";
import { useResizeObserver } from "./useResizeObserver";

export function useSyncLayout<T extends ScrollViewMethods | View | HTMLElement>({
    ref,
    onLayoutChange,
}: {
    ref: React.RefObject<T>;
    onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
    onLayout?: (event: LayoutChangeEvent) => void;
}): { onLayout?: (event: LayoutChangeEvent) => void } {
    useResizeObserver(
        (ref.current as ScrollViewMethods)?.getScrollableNode?.() || ref.current,
        useCallback(
            (entry) => {
                onLayoutChange(entry.contentRect, false);
            },
            [onLayoutChange],
        ),
    );

    useLayoutEffect(() => {
        if (ref.current) {
            const rect = (ref.current as HTMLElement).getBoundingClientRect();
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
