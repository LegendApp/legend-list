import * as React from "react";

import type { LooseScrollViewProps } from "@/platform/scrollview-types";
import { useArr$ } from "@/state/state";

export interface SnapWrapperProps extends LooseScrollViewProps {
    ScrollComponent: React.ComponentType<any>;
}

export const SnapWrapper = React.forwardRef(function SnapWrapperInner(
    { ScrollComponent, ...props }: SnapWrapperProps,
    ref: React.Ref<any>,
) {
    const [snapToOffsets] = useArr$(["snapToOffsets"]);

    return <ScrollComponent {...props} ref={ref} snapToOffsets={snapToOffsets} />;
});
