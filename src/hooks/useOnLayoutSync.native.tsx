// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { useCallback, useLayoutEffect } from "react";
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
    const onLayout = useCallback(
        (event: LayoutChangeEvent) => {
            onLayoutChange(event.nativeEvent.layout, false);
            onLayoutProp?.(event);
        },
        [onLayoutChange],
    );

    if (IsNewArchitecture) {
        useLayoutEffect(() => {
            if (ref.current) {
                ref.current.measure((x, y, width, height) => {
                    onLayoutChange({ height, width, x, y }, true);
                });
            }
        }, deps);
    }

    return { onLayout };
}
