import type { ScrollView, ScrollViewProps } from "@/platform/ScrollView";
import { useArr$ } from "@/state/state";

export interface SnapWrapperProps extends ScrollViewProps {
    ScrollComponent: typeof ScrollView | React.ForwardRefExoticComponent<React.RefAttributes<any>>;
}

export function SnapWrapper({ ScrollComponent, ...props }: SnapWrapperProps) {
    const [snapToOffsets] = useArr$(["snapToOffsets"]);

    return <ScrollComponent {...props} snapToOffsets={snapToOffsets} />;
}
