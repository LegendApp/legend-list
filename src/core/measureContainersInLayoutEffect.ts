import { evaluateBootstrapInitialScroll } from "@/core/bootstrapInitialScroll";
import { getScrollRangeEnd } from "@/core/clampScrollOffset";
import { measureContainerLayoutSize, setContainerLayoutBaseline } from "@/core/containerLayoutBaseline";
import { type ItemSizeMeasurement, isContainerItemCurrent, updateItemSizesBatch } from "@/core/updateItemSizes";
import { peek$, type StateContext } from "@/state/state";
import { getId } from "@/utils/getId";

export function measureContainersInLayoutEffect(
    ctx: StateContext,
    targetContainerIds: ReadonlySet<number> | null = null,
) {
    const dataChangeEpoch = ctx.state.dataChangeEpoch;
    const measurements: (ItemSizeMeasurement & { containerId: number; generation: number })[] = [];
    const containerIds = ctx.state.initialScroll?.bootstrap
        ? ctx.viewRefs.keys()
        : (targetContainerIds ?? ctx.viewRefs.keys());

    for (const containerId of containerIds) {
        const viewRef = ctx.viewRefs.get(containerId);
        const itemKey = peek$(ctx, `containerItemKey${containerId}`);
        const element = viewRef?.current as HTMLElement | null;
        if (itemKey !== undefined && element && isContainerItemCurrent(ctx, containerId, itemKey)) {
            const generation = ctx.state.containerItemGenerations[containerId] ?? 0;
            const size = measureContainerLayoutSize(element);
            // ResizeObserver uses this same border-box baseline to recognize the
            // subsequent observer delivery as confirmation rather than a new change.
            setContainerLayoutBaseline(element, size);
            measurements.push({
                containerId,
                generation,
                itemKey,
                size,
            });
        }
    }

    if (measurements.length > 0) {
        const layoutState = ctx.state;
        const wasMeasuringInLayout = layoutState.measuringContainersInLayout;
        layoutState.measuringContainersInLayout = true;
        try {
            updateItemSizesBatch(ctx, measurements);
        } finally {
            layoutState.measuringContainersInLayout = wasMeasuringInLayout;
        }
        if (!ctx.state.initialScroll?.bootstrap) return;
        ctx.state.scheduledWork.microtask(() => {
            const state = ctx.state;
            const bootstrap = state.initialScroll?.bootstrap;
            if (bootstrap?.visibleIndices?.length && state.dataChangeEpoch === dataChangeEpoch) {
                const measuredKeys = new Set<string>();
                for (const { containerId, generation, itemKey } of measurements) {
                    if (
                        peek$(ctx, `containerItemKey${containerId}`) === itemKey &&
                        (state.containerItemGenerations[containerId] ?? 0) === generation
                    ) {
                        measuredKeys.add(itemKey);
                    }
                }
                const isCurrentViewportMeasured = bootstrap.visibleIndices.every((index) =>
                    measuredKeys.has(getId(state, index)),
                );
                const isCurrentBufferMeasured = Array.from(state.containerItemKeys.keys()).every((key) => {
                    const index = state.indexByKey.get(key);
                    return (
                        index === undefined ||
                        index < state.startBuffered ||
                        index > state.endBuffered ||
                        measuredKeys.has(key)
                    );
                });
                const physicalMax = state.refScroller.current?.getMaxScrollOffset?.();
                const layoutMax = getScrollRangeEnd(ctx);
                if (
                    isCurrentViewportMeasured &&
                    isCurrentBufferMeasured &&
                    physicalMax !== undefined &&
                    Math.abs(physicalMax - layoutMax) <= 1
                ) {
                    evaluateBootstrapInitialScroll(ctx);
                }
            }
        }, "bootstrapMeasuredLayout");
    }
}
