import * as React from "react";

import { ScrollView, type ScrollViewProps } from "./ScrollView";
import { View, type ViewProps } from "./View";

export const AnimatedView = React.forwardRef<HTMLDivElement, ViewProps>(({ style, ...props }, ref) => {
    return <View ref={ref} style={style} {...props} />;
});

export const AnimatedScrollView = React.forwardRef<HTMLDivElement, ScrollViewProps>((props, ref) => {
    return <ScrollView ref={ref} {...props} />;
});
