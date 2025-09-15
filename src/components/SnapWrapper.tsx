// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import React from "react";
import type { ScrollView, ScrollViewProps } from "react-native";

import { useArr$ } from "@/state/state";

export interface SnapWrapperProps extends ScrollViewProps {
    ScrollComponent: typeof ScrollView | React.ForwardRefExoticComponent<React.RefAttributes<unknown>>;
}

export function SnapWrapper({ ScrollComponent, ...props }: SnapWrapperProps) {
    const [snapToOffsets] = useArr$(["snapToOffsets"]);

    return <ScrollComponent {...props} snapToOffsets={snapToOffsets} />;
}
