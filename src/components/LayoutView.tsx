import type { CSSProperties, ReactNode, RefObject } from "react";
import type { View, ViewStyle } from "react-native";

import type { ScrollViewMethods } from "@/components/ListComponentScrollView";
import { useSyncLayout } from "@/hooks/useSyncLayout";
import type { LayoutRectangle } from "@/platform/platform-types";

interface LayoutViewPropsDOM {
    onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
    children: ReactNode;
    refView?: RefObject<ScrollViewMethods>;
    style: CSSProperties;
}

interface LayoutViewProps extends Omit<LayoutViewPropsDOM, "refView" | "style"> {
    refView?: RefObject<ScrollViewMethods | HTMLElement> | RefObject<View>;
    style: ViewStyle | CSSProperties;
}

export const LayoutView = ({ onLayoutChange, refView, children, ...rest }: LayoutViewProps) => {
    useSyncLayout({ onLayoutChange, ref: refView as RefObject<ScrollViewMethods> });
    return (
        <div {...(rest as LayoutViewPropsDOM)} ref={refView as RefObject<any>}>
            {children}
        </div>
    );
};
