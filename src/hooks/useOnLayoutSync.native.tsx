// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { useCallback, useLayoutEffect, useRef } from "react";
import { PixelRatio } from "react-native";
import type { LayoutChangeEvent, LayoutRectangle, View } from "react-native";

import { IsNewArchitecture } from "@/constants-platform";

const FLOATING_POINT_SLACK = 0.01;
const MEASURED_LAYOUT_EPSILON = 1 / PixelRatio.get() + FLOATING_POINT_SLACK;

type StoredLayout = LayoutRectangle & { measuredLayout?: LayoutRectangle };

function isSizeDifferent(a: LayoutRectangle, b: LayoutRectangle, epsilon = 0) {
    return Math.abs(a.height - b.height) > epsilon || Math.abs(a.width - b.width) > epsilon;
}

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
            const didLayoutSizeChange = lastLayout && isSizeDifferent(layout, lastLayout);
            const isMeasuredLayoutNoise =
                !!didLayoutSizeChange &&
                !!lastLayout.measuredLayout &&
                !isSizeDifferent(layout, lastLayout.measuredLayout, MEASURED_LAYOUT_EPSILON);

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
