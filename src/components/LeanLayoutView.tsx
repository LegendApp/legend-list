import type { CSSProperties, ReactNode, RefObject } from "react";
import type { View, ViewStyle } from "react-native";

import { useSyncLayout } from "@/hooks/useSyncLayout";
import type { LayoutRectangle } from "@/platform/Layout.native";

interface LeanLayoutViewPropsDOM {
    onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
    children: ReactNode;
    refView?: RefObject<HTMLDivElement>;
    style: CSSProperties;
}

interface LeanLayoutViewProps extends Omit<LeanLayoutViewPropsDOM, "refView" | "style"> {
    refView?: RefObject<HTMLDivElement> | RefObject<View>;
    style: ViewStyle | CSSProperties;
}

export const LeanLayoutView = ({ onLayoutChange, refView, children, ...rest }: LeanLayoutViewProps) => {
    useSyncLayout({ onLayoutChange, ref: refView as RefObject<HTMLDivElement> });
    return (
        <div {...(rest as LeanLayoutViewPropsDOM)} ref={refView as RefObject<HTMLDivElement>}>
            {children}
        </div>
    );
};
