import type { ScrollView, ScrollViewProps } from "react-native";

import { useArr$ } from "@/state/state";

export interface SnapWrapperProps extends ScrollViewProps {
    ScrollComponent: typeof ScrollView;
}

export function SnapWrapper({ ScrollComponent, ...props }: SnapWrapperProps) {
    const [snapToOffsets] = useArr$(["snapToOffsets"]);

    return <ScrollComponent {...props} snapToOffsets={snapToOffsets} />;
}
