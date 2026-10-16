import { evaluateBootstrapInitialScroll } from "@/core/bootstrapInitialScroll";
import { setContainerLayoutBaseline } from "@/core/containerLayoutBaseline";
import { type ItemSizeMeasurement, updateItemSizesBatch } from "@/core/updateItemSizes";
import { getContentSize } from "@/state/getContentSize";
import { peek$, type StateContext } from "@/state/state";
import { getId } from "@/utils/getId";

export function measureContainersInLayoutEffect(
    ctx: StateContext,
    targetContainerIds: ReadonlySet<number> | null = null,
) {
    const dataChangeEpoch = ctx.state.dataChangeEpoch;
    const measurements: (ItemSizeMeasurement & { containerId: number; generation: number })[] = [];
    const containerIds =
        ctx.state.initialScrollSession?.kind === "bootstrap" && ctx.state.initialScrollSession.bootstrap
            ? ctx.viewRefs.keys()
            : (targetContainerIds ?? ctx.viewRefs.keys());

    for (const containerId of containerIds) {
        const viewRef = ctx.viewRefs.get(containerId);
        const itemKey = peek$(ctx, `containerItemKey${containerId}`);
        const element = viewRef?.current as HTMLElement | null;
        if (itemKey !== undefined && element) {
            const generation = ctx.state.containerItemGenerations[containerId] ?? 0;
            const rect = element.getBoundingClientRect();
            // ResizeObserver uses this same border-box baseline to recognize the
            // subsequent observer delivery as confirmation rather than a new change.
            setContainerLayoutBaseline(element, rect);
            measurements.push({
                containerId,
                generation,
                itemKey,
                size: { height: rect.height, width: rect.width },
            });
        }
    }

    if (measurements.length > 0) {
        updateItemSizesBatch(ctx, measurements);
        if (ctx.state.initialScrollSession?.kind !== "bootstrap" || !ctx.state.initialScrollSession.bootstrap) return;
        ctx.state.scheduledWork.microtask(() => {
            const state = ctx.state;
            const bootstrap =
                state.initialScrollSession?.kind === "bootstrap" ? state.initialScrollSession.bootstrap : undefined;
            if (bootstrap?.visibleIndices?.length && state.dataChangeEpoch === dataChangeEpoch) {
                const measuredKeys = new Set(
                    measurements
                        .filter(
                            ({ containerId, generation, itemKey }) =>
                                peek$(ctx, `containerItemKey${containerId}`) === itemKey &&
                                (state.containerItemGenerations[containerId] ?? 0) === generation,
                        )
                        .map(({ itemKey }) => itemKey),
                );
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
                const layoutMax = Math.max(0, getContentSize(ctx) - state.scrollLength);
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
