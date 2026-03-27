// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { useLayoutEffect, useRef } from "react";

import { useValue$ } from "@/hooks/useValue$";

interface UseOnLayoutSyncProps {
    onLayoutChange: (rectangle: { width: number; height: number }, fromLayoutEffect: boolean) => void;
    ref: React.RefObject<any>;
}

export const useOnLayoutSync = ({ onLayoutChange, ref }: UseOnLayoutSyncProps) => {
    const lastLayoutRef = useRef<{ width: number; height: number }>();
    const didLayoutRef = useRef(false);

    const onLayout = React.useCallback(
        (event: { nativeEvent: { layout: { width: number; height: number } } }) => {
            const { width, height } = event.nativeEvent.layout;
            const lastLayout = lastLayoutRef.current;

            // Only call onLayoutChange if the layout actually changed
            if (!lastLayout || lastLayout.width !== width || lastLayout.height !== height) {
                lastLayoutRef.current = { width, height };
                onLayoutChange({ width, height }, didLayoutRef.current);
            }
        },
        [onLayoutChange]
    );

    useLayoutEffect(() => {
        // Set initial layout to avoid immediate callback
        if (ref.current) {
            const layout = ref.current._internalFiberInstance?.stateNode?.props?.layout;
            if (layout) {
                lastLayoutRef.current = { width: layout.width, height: layout.height };
                didLayoutRef.current = true;
            }
        }
    }, [ref]);

    return { onLayout };
};