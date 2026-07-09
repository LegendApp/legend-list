// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { type CSSProperties, type RefObject, useRef } from "react";

import type { ScrollViewMethods } from "@/components/ListComponentScrollView";
import { useOnLayoutSync } from "@/hooks/useOnLayoutSync";
import type { LayoutRectangle } from "@/platform/platform-types";
import type { LooseView, StyleProp, ViewStyle } from "@/platform/scrollview-types";

interface LayoutViewPropsDOM {
    children: React.ReactNode;
    onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
    refView?: RefObject<ScrollViewMethods | null>;
    style: CSSProperties;
}

interface LayoutViewProps extends Omit<LayoutViewPropsDOM, "refView" | "style"> {
    refView?: RefObject<ScrollViewMethods | HTMLElement | LooseView | null>;
    style: StyleProp<ViewStyle> | CSSProperties;
}

export const LayoutView = ({ onLayoutChange, refView, children, ...rest }: LayoutViewProps) => {
    const localRef = useRef<ScrollViewMethods | null>(null);
    const ref = refView ?? localRef;
    useOnLayoutSync({ onLayoutChange, ref });
    return (
        <div {...(rest as LayoutViewPropsDOM)} ref={ref as RefObject<HTMLDivElement>}>
            {children}
        </div>
    );
};
