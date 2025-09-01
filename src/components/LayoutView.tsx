// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { type CSSProperties, type RefObject, useRef } from "react";
import type { View, ViewStyle } from "react-native";

import type { ScrollViewMethods } from "@/components/ListComponentScrollView";
import { useSyncLayout } from "@/hooks/useSyncLayout";
import type { LayoutRectangle } from "@/platform/platform-types";

interface LayoutViewPropsDOM {
    children: React.ReactNode;
    onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
    refView?: RefObject<ScrollViewMethods>;
    style: CSSProperties;
}

interface LayoutViewProps extends Omit<LayoutViewPropsDOM, "refView" | "style"> {
    refView?: RefObject<ScrollViewMethods | HTMLElement> | RefObject<View>;
    style: ViewStyle | CSSProperties;
}

export const LayoutView = ({ onLayoutChange, refView, children, ...rest }: LayoutViewProps) => {
    const ref = (refView as RefObject<any>) ?? useRef<ScrollViewMethods>();
    useSyncLayout({ onLayoutChange, ref });
    return (
        <div {...(rest as LayoutViewPropsDOM)} ref={ref as RefObject<any>}>
            {children}
        </div>
    );
};
