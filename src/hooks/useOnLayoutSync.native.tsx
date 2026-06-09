// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { LayoutChangeEvent, LayoutRectangle, View } from "react-native";

import { IsNewArchitecture } from "@/constants-platform";
import { isNativeLayoutSizeNoise } from "@/utils/layoutMeasurement";

type StoredLayout = LayoutRectangle & { measuredLayout?: LayoutRectangle };

export function useOnLayoutSync<T extends View = View>(
    {
        ref,
        onLayoutProp,
        onLayoutChange,
    }: {
        ref: React.RefObject<T | null>;
        onLayoutProp?: (event: LayoutChangeEvent) => void;
        onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
    },
    deps: any[] = [],
): { onLayout: (event: LayoutChangeEvent) => void } {
    const lastLayoutRef = useRef<StoredLayout | null>(null);
    const onLayout = useCallback(
        (event: LayoutChangeEvent) => {
            const { layout } = event.nativeEvent;
            const lastLayout = lastLayoutRef.current;
            const didLayoutSizeChange =
                lastLayout && (layout.height !== lastLayout.height || layout.width !== lastLayout.width);
            const isMeasuredLayoutNoise =
                !!didLayoutSizeChange &&
                !!lastLayout.measuredLayout &&
                isNativeLayoutSizeNoise(
                    layout.height - lastLayout.measuredLayout.height,
                    layout.width - lastLayout.measuredLayout.width,
                );

            if (!lastLayout || (didLayoutSizeChange && !isMeasuredLayoutNoise)) {
                onLayoutChange(layout, false);
            }
            if (!lastLayout || didLayoutSizeChange) {
                lastLayoutRef.current = {
                    ...layout,
                    measuredLayout: isMeasuredLayoutNoise ? lastLayout?.measuredLayout : undefined,
                };
            }

            onLayoutProp?.(event);
        },
        [onLayoutChange, onLayoutProp],
    );

    if (IsNewArchitecture) {
        useLayoutEffect(() => {
            if (ref.current) {
                ref.current.measure((x, y, width, height) => {
                    const layout = { height, width, x, y };
                    lastLayoutRef.current = { ...layout, measuredLayout: layout };
                    onLayoutChange(layout, true);
                });
            }
        }, deps);
    }

    return { onLayout };
}
