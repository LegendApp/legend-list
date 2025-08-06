import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { LayoutChangeEvent, LayoutRectangle } from "@/platform/Layout";
import type { WebViewMethods } from "@/platform/View";

import { IsNewArchitecture } from "@/constants";
import { useThrottleDebounce } from "./useThrottleDebounce";

export function useSyncLayoutState<T extends HTMLDivElement & WebViewMethods = HTMLDivElement & WebViewMethods>({
    getValue,
    debounce: debounceMs,
    onChange: onChangeProp,
}: {
    getValue: (rectangle: LayoutRectangle) => number;
    debounce?: number | undefined;
    onChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
}) {
    const debounce = useThrottleDebounce("debounce");
    const [value, setValue] = useState(0);

    const onChange = useCallback(
        (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => {
            const height = getValue(rectangle);

            if (debounceMs === undefined) {
                setValue(height);
            } else {
                // Debounce the setViewHeight call
                debounce(() => {
                    setValue(height);
                }, debounceMs);
            }

            onChangeProp?.(rectangle, fromLayoutEffect);
        },
        [getValue, debounceMs, debounce],
    );

    const { onLayout, ref } = useSyncLayout<T>({ onChange });

    return { onLayout, ref, value };
}

export function useSyncLayout<T extends HTMLDivElement & WebViewMethods = HTMLDivElement & WebViewMethods>({
    onChange,
}: {
    onChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
}) {
    const ref = useRef<T | null>(null);

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

    return { onLayout, ref };
}
