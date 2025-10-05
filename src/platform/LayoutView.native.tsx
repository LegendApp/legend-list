import type * as React from "react";
import { type RefObject, useRef } from "react";
import { type LayoutRectangle, View, type ViewProps } from "react-native";

import { useOnLayoutSync } from "@/hooks/useOnLayoutSync";

interface LayoutViewProps extends Omit<ViewProps, "onLayout"> {
    refView?: React.RefObject<View>;
    onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
}

export const LayoutView = ({ onLayoutChange, refView, ...rest }: LayoutViewProps) => {
    const ref = (refView as RefObject<any>) ?? useRef<View>();
    const { onLayout } = useOnLayoutSync({ onLayoutChange, ref });
    return <View {...rest} onLayout={onLayout} ref={ref} />;
};
