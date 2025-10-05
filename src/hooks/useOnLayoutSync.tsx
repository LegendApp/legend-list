// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { useCallback, useLayoutEffect } from "react";
import type { LayoutChangeEvent, LayoutRectangle, View } from "react-native";

import type { ScrollViewMethods } from "@/components/ListComponentScrollView";
import { useResizeObserver } from "@/hooks/useResizeObserver";

export function useOnLayoutSync<T extends ScrollViewMethods | View | HTMLElement>(
    {
        ref,
        onLayoutProp,
        onLayoutChange,
    }: {
        ref: React.RefObject<T>;
        onLayoutProp?: (event: LayoutChangeEvent) => void;
        onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
    },
    // biome-ignore lint/correctness/noUnusedFunctionParameters: Used in native
    deps?: any[],
): { onLayout?: (event: LayoutChangeEvent) => void } {
    useLayoutEffect(() => {
        if (ref.current) {
            const rect = (ref.current as HTMLElement).getBoundingClientRect();
            const layout = {
                height: rect.height,
                width: rect.width,
                x: rect.left,
                y: rect.top,
            };
            onLayoutChange(layout, true);
            // TODO: Fix the type
            onLayoutProp?.({ nativeEvent: { layout } } as LayoutChangeEvent);
        }
    }, []);

    useResizeObserver(
        (ref.current as ScrollViewMethods)?.getScrollableNode?.() || ref.current,
        useCallback(
            (entry) => {
                onLayoutChange(entry.contentRect, false);
            },
            [onLayoutChange],
        ),
    );

    return {};
}
