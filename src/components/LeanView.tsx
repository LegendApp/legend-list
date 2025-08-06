import * as React from "react";
import { Platform } from "@/platform/Platform";
import { View, type ViewProps } from "@/platform/View";

// Thanks to @hirbod
// https://gist.github.com/hirbod/03d487f40b4c091d2c56ebfb17dba7ed

const LeanViewComponent = React.forwardRef<View, ViewProps>((props, ref) => {
    return React.createElement("RCTView", { ...props, ref });
});

LeanViewComponent.displayName = "RCTView";

// LeanView doesn't work well on web, and not sure how it works on other platforms,
// so just use it on iOS and Android for now. Could expand this later if we know it's safe
// for specific other platforms.
const LeanView = Platform.OS === "android" || Platform.OS === "ios" ? LeanViewComponent : View;

export { LeanView };
