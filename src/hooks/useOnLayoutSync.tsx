// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { useCallback, useLayoutEffect } from "react";

import type { ScrollViewMethods } from "@/components/ListComponentScrollView";
import { getContainerLayoutBaseline } from "@/core/containerLayoutBaseline";
import { createResizeObserver } from "@/hooks/createResizeObserver";
import type { LayoutChangeEvent, LayoutRectangle, LooseView } from "@/platform/scrollview-types";

export function useOnLayoutSync<T extends ScrollViewMethods | LooseView | HTMLElement>(
    {
        ref,
        measureInLayoutEffect = true,
        onLayoutProp,
        onLayoutChange,
        webLayoutResync,
        webExternalScroll = false,
    }: {
        ref: React.RefObject<T | null>;
        measureInLayoutEffect?: boolean;
        onLayoutProp?: (event: LayoutChangeEvent) => void;
        onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
        webLayoutResync?: () => boolean;
        webExternalScroll?: boolean;
    },
    deps?: any[],
): { onLayout?: (event: LayoutChangeEvent) => void } {
    const onExternalLayout = useCallback(
        (event: LayoutChangeEvent) => {
            onLayoutChange(event.nativeEvent.layout, false);
            onLayoutProp?.(event);
        },
        [onLayoutChange, onLayoutProp],
    );

    useLayoutEffect(() => {
        // The web scroll adapter measures the owner's viewport and list-relative position.
        if (webExternalScroll) return;
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

        let prevRect: Pick<DOMRectReadOnly, "height" | "width"> | undefined;
        if (measureInLayoutEffect) {
            const rect = element.getBoundingClientRect();
            emit(toLayout(rect), true);
            prevRect = rect;
        }

        return createResizeObserver(element, (entry) => {
            const target = entry.target instanceof HTMLElement ? entry.target : undefined;
            const borderBoxSize = Array.isArray(entry.borderBoxSize) ? entry.borderBoxSize[0] : entry.borderBoxSize;
            // Prefer the observer's border-box payload: it matches the parent baseline
            // without another layout read. Older implementations fall back to a DOM read.
            const rectObserved = borderBoxSize
                ? {
                      height: borderBoxSize.blockSize,
                      left: entry.contentRect.left,
                      top: entry.contentRect.top,
                      width: borderBoxSize.inlineSize,
                  }
                : (target?.getBoundingClientRect() ?? entry.contentRect);
            const previousRect = prevRect ?? getContainerLayoutBaseline(element);
            const didSizeChange =
                previousRect === undefined ||
                rectObserved.width !== previousRect.width ||
                rectObserved.height !== previousRect.height;
            prevRect = rectObserved;
            // MVCP on web can require a fresh onLayout pass even when the observer size is unchanged.
            const shouldResyncLayout = !!webLayoutResync?.();
            if (didSizeChange || shouldResyncLayout) {
                emit(toLayout(rectObserved), false);
            }
        });
    }, [measureInLayoutEffect, webExternalScroll, ...(deps || [])]);

    return webExternalScroll ? { onLayout: onExternalLayout } : {};
}

function toLayout(rect: Pick<DOMRectReadOnly, "height" | "left" | "top" | "width"> | undefined): LayoutRectangle {
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
