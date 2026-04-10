import { useArr$, useStateContext } from "@/state/state";

export function WebAnchoredEndSpace({ horizontal }: { horizontal: boolean }) {
    const ctx = useStateContext();
    const [anchoredEndSpaceSize] = useArr$(["anchoredEndSpaceSize"]);
    const shouldRenderAnchoredEndSpace = !!ctx.state.props.anchoredEndSpace && (anchoredEndSpaceSize || 0) > 0;

    if (!shouldRenderAnchoredEndSpace) {
        return null;
    }

    const style = horizontal
        ? { height: "100%", width: anchoredEndSpaceSize || 0 }
        : { height: anchoredEndSpaceSize || 0 };

    return <div style={style}>{null}</div>;
}
