// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { LayoutChangeEvent, LayoutRectangle, View } from "react-native";

import { IsNewArchitecture } from "@/constants-platform";

export function useOnLayoutSync<T extends View = View>(
    {
        ref,
        onLayoutProp,
        onLayoutChange,
    }: {
        ref: React.RefObject<T>;
        onLayoutProp?: (event: LayoutChangeEvent) => void;
        onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
    },
    deps: any[] = [],
): { onLayout: (event: LayoutChangeEvent) => void } {
    const lastLayoutRef = useRef<LayoutRectangle | null>(null);
    const onLayout = useCallback(
        (event: LayoutChangeEvent) => {
            const { layout } = event.nativeEvent;
            if (layout.height !== lastLayoutRef.current?.height || layout.width !== lastLayoutRef.current?.width) {
                onLayoutChange(layout, false);
                onLayoutProp?.(event);
                lastLayoutRef.current = layout;
            }
        },
        [onLayoutChange],
    );

    if (IsNewArchitecture) {
        useLayoutEffect(() => {
            if (ref.current) {
                ref.current.measure((x, y, width, height) => {
                    const layout = { height, width, x, y };
                    lastLayoutRef.current = layout;
                    onLayoutChange(layout, true);
                });
            }
        }, deps);
    }

    return { onLayout };
}
