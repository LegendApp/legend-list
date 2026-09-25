// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { useCallback, useLayoutEffect } from "react";
import type { LayoutChangeEvent, LayoutRectangle, View } from "react-native";

import { IsNewArchitecture } from "@/constants-platform";

export function useOnLayoutSync<T extends View = View>(
    {
        ref,
        measureInLayoutEffect = true,
        onLayoutProp,
        onLayoutChange,
    }: {
        ref: React.RefObject<T | null>;
        measureInLayoutEffect?: boolean;
        webExternalScroll?: boolean;
        onLayoutProp?: (event: LayoutChangeEvent) => void;
        onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
    },
    deps: any[] = [],
): { onLayout: (event: LayoutChangeEvent) => void } {
    const onLayout = useCallback(
        (event: LayoutChangeEvent) => {
            const { layout } = event.nativeEvent;
            onLayoutChange(layout, false);
            onLayoutProp?.(event);
        },
        [onLayoutChange, onLayoutProp],
    );

    if (IsNewArchitecture) {
        useLayoutEffect(() => {
            if (measureInLayoutEffect && ref.current) {
                // measure is synchronous in new architecture
                ref.current.measure((x, y, width, height) => {
                    onLayoutChange({ height, width, x, y }, true);
                });
            }
        }, [measureInLayoutEffect, ...deps]);
    }

    return { onLayout };
}
