import { resolveContainerItemMetadata } from "@/core/containerItemMetadata";
import { type ItemSizeMeasurement, updateItemSizes, updateItemSizesBatch } from "@/core/updateItemSizes";
import { peek$, type StateContext, set$ } from "@/state/state";

function resolveFixedItemSize(ctx: StateContext, containerId: number, itemKey: string) {
    const state = ctx.state;
    const { data, getFixedItemSize } = state.props;
    const index = state.indexByKey.get(itemKey);
    let fixedItemSize: number | undefined;

    if (data && getFixedItemSize && index !== undefined) {
        const itemData = data[index];
        if (itemData !== undefined) {
            fixedItemSize = resolveContainerItemMetadata(state, containerId, index, itemData)?.fixedItemSize;
        }
    }

    return fixedItemSize;
}

function resolveSkippedAnchorReset(ctx: StateContext, itemKey: string) {
    const state = ctx.state;
    const anchorReset = state.userScrollAnchorReset;
    if (anchorReset?.keys.delete(itemKey) && anchorReset.keys.size === 0) {
        state.userScrollAnchorReset = undefined;
    }
}

function revealMeasuredContainer(ctx: StateContext, containerId: number, itemKey: string) {
    if (peek$(ctx, `containerItemKey${containerId}`) !== itemKey) {
        return;
    }

    const metadata = ctx.state.containerItemMetadata.get(containerId);
    if (metadata?.measurementPending) {
        metadata.measurementPending = false;
        const epochName = `containerMeasurementEpoch${containerId}` as const;
        set$(ctx, epochName, (peek$(ctx, epochName) ?? 0) + 1);
    }
}

export function measureContainersInLayoutEffect(
    ctx: StateContext,
    targetContainerIds: ReadonlySet<number> | null = null,
) {
    const state = ctx.state;
    const measurements: Array<ItemSizeMeasurement & { containerId: number }> = [];
    // Fabric normally invokes measure callbacks inline. Keep those results together,
    // but let an unexpectedly late callback update independently after this pass closes.
    let isCollectingSynchronousMeasurements = true;
    const containerIds = targetContainerIds ?? ctx.viewRefs.keys();

    for (const containerId of containerIds) {
        const viewRef = ctx.viewRefs.get(containerId);
        const itemKey = peek$(ctx, `containerItemKey${containerId}`);
        if (itemKey !== undefined) {
            // Assignment changes also advance this token. Advancing it for every pass
            // prevents an older same-key callback from overwriting a newer measurement.
            const generation = (state.containerItemGenerations[containerId] ?? 0) + 1;
            state.containerItemGenerations[containerId] = generation;
            const fixedItemSize = resolveFixedItemSize(ctx, containerId, itemKey);
            // sizesKnown includes the list's scroll-axis gap, while the fixed-size
            // callback describes only the item itself.
            const canSkipMeasurement =
                !state.needsOtherAxisSize &&
                fixedItemSize !== undefined &&
                state.sizesKnown.get(itemKey) === fixedItemSize + ctx.scrollAxisGap;
            if (canSkipMeasurement) {
                resolveSkippedAnchorReset(ctx, itemKey);
                revealMeasuredContainer(ctx, containerId, itemKey);
            } else if (viewRef) {
                viewRef.current?.measure?.((_x, _y, width, height) => {
                    const isCurrentGeneration = (ctx.state.containerItemGenerations[containerId] ?? 0) === generation;
                    if (isCurrentGeneration) {
                        const measurement: ItemSizeMeasurement & { containerId: number } = {
                            containerId,
                            itemKey,
                            size: { height, width },
                        };
                        if (isCollectingSynchronousMeasurements) {
                            measurements.push(measurement);
                        } else {
                            updateItemSizes(ctx, measurement);
                            revealMeasuredContainer(ctx, containerId, itemKey);
                        }
                    }
                });
            }
        }
    }

    isCollectingSynchronousMeasurements = false;
    if (measurements.length > 0) {
        updateItemSizesBatch(ctx, measurements);
        // Recalculation publishes corrected positions before any pending row becomes visible.
        for (const { containerId, itemKey } of measurements) {
            revealMeasuredContainer(ctx, containerId, itemKey);
        }
    }
}
