import { useCallback, useLayoutEffect } from "react";

import { IsNewArchitecture } from "@/constants-platform";
import type { LayoutChangeEvent, LayoutRectangle } from "@/platform/Layout";
import type { WebViewMethods } from "@/platform/View";

export function useSyncLayout<T extends HTMLDivElement & WebViewMethods = HTMLDivElement & WebViewMethods>({
    ref,
    onChange,
}: {
    ref: React.RefObject<T>;
    onChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
}): { onLayout: (event: LayoutChangeEvent) => void } {
    const onLayout = useCallback(
        (event: LayoutChangeEvent) => {
            onChange(event.nativeEvent.layout, false);
        },
        [onChange],
    );

    if (IsNewArchitecture) {
        useLayoutEffect(() => {
            if (ref.current) {
                ref.current.measure((x, y, width, height) => {
                    onChange({ height, width, x, y }, true);
                });
            }
        }, []);
    }

    return { onLayout };
}
