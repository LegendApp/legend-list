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
    deps?: any[],
): { onLayout?: (event: LayoutChangeEvent) => void } {
    useLayoutEffect(() => {
        const current = ref.current;
        const scrollableNode = (current as ScrollViewMethods | null)?.getScrollableNode?.() ?? null;
        const element = (scrollableNode || current) as HTMLElement | null;

        if (!element) {
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
        let prevRect = rect;

        return createResizeObserver(element, (entry) => {
            const target = entry.target instanceof HTMLElement ? entry.target : undefined;
            const rect = entry.contentRect ?? target?.getBoundingClientRect();
            if (rect.width !== prevRect.width || rect.height !== prevRect.height) {
                prevRect = rect;
                emit(toLayout(rect), false);
            }
        });
    }, deps || []);

    return {};
}

function toLayout(rect: DOMRect | DOMRectReadOnly | undefined): LayoutRectangle {
    if (!rect) {
        // In non-DOM environments (e.g. react-native tests) ResizeObserver entries may lack contentRect.
        return { height: 0, width: 0, x: 0, y: 0 };
    }

    return {
        height: rect.height,
        width: rect.width,
        x: rect.left,
        y: rect.top,
    };
}
