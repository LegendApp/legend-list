import * as React from "react";
import { Platform } from "@/platform/Platform";
import { View, type ViewProps, type WebViewMethods } from "@/platform/View";

// Thanks to @hirbod
// https://gist.github.com/hirbod/03d487f40b4c091d2c56ebfb17dba7ed

const LeanViewComponent = React.forwardRef<HTMLDivElement & WebViewMethods, ViewProps>((props, ref) => {
    return React.createElement("RCTView", { ...props, ref });
});

LeanViewComponent.displayName = "RCTView";

// LeanView doesn't work well on web, and we're on web, so just use regular View
const LeanView = Platform.OS === "web" ? View : LeanViewComponent;

export { LeanView };
