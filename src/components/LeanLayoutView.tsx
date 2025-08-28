import { useSyncLayout } from "@/hooks/useSyncLayout";
import type { LayoutRectangle } from "@/platform/Layout.native";

interface LeanLayoutViewProps {
    refView: React.RefObject<HTMLDivElement>;
    onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
}

export const LeanLayoutView = ({ onLayoutChange, refView, ...rest }: LeanLayoutViewProps) => {
    useSyncLayout({ onLayoutChange, ref: refView });
    return <div {...rest} ref={refView} />;
};
