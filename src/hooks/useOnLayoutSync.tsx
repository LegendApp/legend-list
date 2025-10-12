// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { useLayoutEffect } from "react";
import type { LayoutChangeEvent, LayoutRectangle, View } from "react-native";

import type { ScrollViewMethods } from "@/components/ListComponentScrollView";
import { createResizeObserver } from "@/hooks/createResizeObserver";

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
        const current = ref.current;
        const scrollableNode = (current as ScrollViewMethods | null)?.getScrollableNode?.() ?? null;
        const element = (scrollableNode || current) as HTMLElement | null;

        if (!element || !(element instanceof HTMLElement)) {
            return;
        }

        const emit = (layout: LayoutRectangle, fromLayoutEffect: boolean) => {
            if (layout.height === 0 && layout.width === 0) {
                return;
            }

            onLayoutChange(layout, fromLayoutEffect);
            onLayoutProp?.({ nativeEvent: { layout } } as LayoutChangeEvent);
        };

        const rect = element.getBoundingClientRect();
        emit(toLayout(rect), true);

        return createResizeObserver(element, (entry) => {
            const target = entry.target instanceof HTMLElement ? entry.target : undefined;
            const rect = entry.contentRect ?? target?.getBoundingClientRect();
            emit(toLayout(rect), false);
        });
    }, []);

    return {};
}

function toLayout(rect: DOMRect | DOMRectReadOnly): LayoutRectangle {
    return {
        height: rect.height,
        width: rect.width,
        x: rect.left,
        y: rect.top,
    };
}
