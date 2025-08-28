import * as React from "react";

import { useSyncLayout } from "@/hooks/useSyncLayout";
import type { LayoutRectangle } from "@/platform/Layout.native";
import type { ViewProps, WebViewMethods } from "@/platform/View";

// Thanks to @hirbod
// https://gist.github.com/hirbod/03d487f40b4c091d2c56ebfb17dba7ed

const LeanView = React.forwardRef<HTMLDivElement & WebViewMethods, ViewProps>((props, ref) => {
    return React.createElement("RCTView", { ...props, ref });
});

LeanView.displayName = "RCTView";

interface LeanLayoutViewProps extends Omit<ViewProps, "onLayout"> {
    refView: React.RefObject<HTMLDivElement & WebViewMethods>;
    onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
}

const LeanLayoutView = ({ onLayoutChange, refView, ...rest }: LeanLayoutViewProps) => {
    const { onLayout } = useSyncLayout({ onChange: onLayoutChange, ref: refView });
    return <LeanView {...rest} onLayout={onLayout} ref={refView} />;
};

export { LeanLayoutView };
