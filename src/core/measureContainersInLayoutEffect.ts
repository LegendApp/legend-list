import { setContainerLayoutBaseline } from "@/core/containerLayoutBaseline";
import { type ItemSizeMeasurement, updateItemSizesBatch } from "@/core/updateItemSizes";
import { peek$, type StateContext } from "@/state/state";

export function measureContainersInLayoutEffect(
    ctx: StateContext,
    targetContainerIds: ReadonlySet<number> | null = null,
) {
    const measurements: ItemSizeMeasurement[] = [];
    const containerIds = targetContainerIds ?? ctx.viewRefs.keys();

    for (const containerId of containerIds) {
        const viewRef = ctx.viewRefs.get(containerId);
        const itemKey = peek$(ctx, `containerItemKey${containerId}`);
        const element = viewRef?.current as HTMLElement | null;
        if (itemKey !== undefined && element) {
            const rect = element.getBoundingClientRect();
            // A detached or display: none list reports 0x0 for every row. Recording that
            // collapses the list, which mounts more containers that also measure 0x0, and
            // repeats until React throws "Maximum update depth exceeded". The observer path
            // ignores 0x0 for the same reason; the next real layout measures the row.
            if (rect.width === 0 && rect.height === 0) {
                continue;
            }
            // ResizeObserver uses this same border-box baseline to recognize the
            // subsequent observer delivery as confirmation rather than a new change.
            setContainerLayoutBaseline(element, rect);
            measurements.push({
                containerId,
                itemKey,
                size: { height: rect.height, width: rect.width },
            });
        }
    }

    if (measurements.length > 0) {
        updateItemSizesBatch(ctx, measurements);
    }
}
