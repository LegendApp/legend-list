import { useSyncLayout } from "@/hooks/useSyncLayout";

export const LeanLayoutView = ({ onLayoutChange, refView, ...rest }: LeanLayoutViewProps) => {
    useSyncLayout({ onLayoutChange, ref: refView });
    return <div {...rest} ref={refView} />;
};
