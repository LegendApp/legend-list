// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";

import type { LooseScrollViewProps } from "@/platform/scrollview-types";
import { useArr$ } from "@/state/state";

export interface SnapWrapperProps extends LooseScrollViewProps {
    ScrollComponent: React.ComponentType<any>;
}

export function SnapWrapper({ ScrollComponent, ...props }: SnapWrapperProps) {
    const [snapToOffsets] = useArr$(["snapToOffsets"]);

    return <ScrollComponent {...props} snapToOffsets={snapToOffsets} />;
}
