import * as React from "react";
import type { View, ViewProps } from "react-native";

import { useSyncLayout } from "@/hooks/useSyncLayout";
import type { LayoutRectangle } from "@/platform/platform-types";

// Thanks to @hirbod
// https://gist.github.com/hirbod/03d487f40b4c091d2c56ebfb17dba7ed

const LeanView = React.forwardRef<View, ViewProps>((props, ref) => {
    return React.createElement("RCTView", { ...props, ref });
});

LeanView.displayName = "RCTView";

interface LeanLayoutViewProps extends Omit<ViewProps, "onLayout"> {
    refView: React.RefObject<View>;
    onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
}

export const LeanLayoutView = ({ onLayoutChange, refView, ...rest }: LeanLayoutViewProps) => {
    const { onLayout } = useSyncLayout({ onLayoutChange, ref: refView });
    return <LeanView {...rest} onLayout={onLayout} ref={refView} />;
};
