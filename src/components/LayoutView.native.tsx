import type * as React from "react";
import { View, type ViewProps } from "react-native";

import { useSyncLayout } from "@/hooks/useSyncLayout";
import type { LayoutRectangle } from "@/platform/platform-types";

interface LayoutViewProps extends Omit<ViewProps, "onLayout"> {
    refView: React.RefObject<View>;
    onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
}

export const LayoutView = ({ onLayoutChange, refView, ...rest }: LayoutViewProps) => {
    const { onLayout } = useSyncLayout({ onLayoutChange, ref: refView });
    return <View {...rest} onLayout={onLayout} ref={refView} />;
};
