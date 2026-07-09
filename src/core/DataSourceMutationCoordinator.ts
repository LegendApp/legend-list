import { getLayoutOffset } from "@/core/layoutAccessors";
import { notifyPosition$, peek$, type StateContext, set$ } from "@/state/state";
import type { DataSourceMutationBatch, DataSourceOperation, LegendListDataSource, ViewToken } from "@/types.base";

interface MaterializedEntry {
    index: number;
    key: string;
}

export interface DataSourceMutationResult {
    applied: boolean;
    materializedCount: number;
    resetReason?: string;
}

function transformMoveIndex(index: number, from: number, to: number, count: number) {
    let nextIndex = index;
    if (count > 0 && from !== to) {
        if (index >= from && index < from + count) {
            nextIndex = to + index - from;
        } else {
            const indexAfterRemoval = index >= from + count ? index - count : index;
            nextIndex = indexAfterRemoval >= to ? indexAfterRemoval + count : indexAfterRemoval;
        }
    }
    return nextIndex;
}

export function transformDataSourceIndex(index: number, operations: readonly DataSourceOperation[]) {
    let nextIndex = index;
    for (const operation of operations) {
        if (operation.type === "splice") {
            const deletedEnd = operation.index + operation.deleteCount;
            if (nextIndex >= deletedEnd) {
                nextIndex += operation.insertCount - operation.deleteCount;
            } else if (nextIndex >= operation.index) {
                const insertedOffset = Math.min(nextIndex - operation.index, Math.max(0, operation.insertCount - 1));
                nextIndex = operation.index + insertedOffset;
            }
        } else if (operation.type === "move") {
            nextIndex = transformMoveIndex(nextIndex, operation.from, operation.to, operation.count);
        }
    }
    return nextIndex;
}

function collectMaterializedEntries(ctx: StateContext) {
    const { idCache, indexByKey } = ctx.state;
    const byIndex = new Map<number, MaterializedEntry>();
    for (const key of Object.keys(idCache)) {
        const index = Number(key);
        const itemKey = idCache[index];
        if (Number.isInteger(index) && itemKey !== undefined) {
            byIndex.set(index, { index, key: itemKey });
        }
    }
    for (const [itemKey, index] of indexByKey) {
        if (Number.isInteger(index) && !byIndex.has(index)) {
            byIndex.set(index, { index, key: itemKey });
        }
    }
    return byIndex;
}

function snapshotAnchorPositions(ctx: StateContext) {
    const state = ctx.state;
    const anchorKeys = new Set(state.idsInView);
    if (state.scrollingTo?.index !== undefined) {
        const scrollTargetKey =
            state.idCache[state.scrollingTo.index] ??
            Array.from(state.indexByKey).find((entry) => entry[1] === state.scrollingTo?.index)?.[0];
        if (scrollTargetKey !== undefined) {
            anchorKeys.add(scrollTargetKey);
        }
    }

    const positions = new Map<string, number>();
    for (const key of anchorKeys) {
        const index = state.indexByKey.get(key);
        const offset = getLayoutOffset(ctx, index);
        if (offset !== undefined) {
            positions.set(key, offset);
        }
    }
    return positions;
}

function applyOperationToEntries(
    entries: Map<number, MaterializedEntry>,
    operation: DataSourceOperation,
    invalidatedKeys: Set<string>,
    rerenderKeys: Set<string>,
    removedKeys: Set<string>,
) {
    const nextEntries = new Map<number, MaterializedEntry>();
    for (const entry of entries.values()) {
        let nextIndex = entry.index;
        let isRemoved = false;
        if (operation.type === "splice") {
            const deletedEnd = operation.index + operation.deleteCount;
            if (entry.index >= operation.index && entry.index < deletedEnd) {
                isRemoved = true;
            } else if (entry.index >= deletedEnd) {
                nextIndex += operation.insertCount - operation.deleteCount;
            }
        } else if (operation.type === "move") {
            nextIndex = transformMoveIndex(entry.index, operation.from, operation.to, operation.count);
        } else if (
            operation.type === "update" &&
            entry.index >= operation.index &&
            entry.index < operation.index + operation.count
        ) {
            rerenderKeys.add(entry.key);
            if (operation.layout === "invalidate") {
                invalidatedKeys.add(entry.key);
            }
        }

        if (isRemoved) {
            removedKeys.add(entry.key);
        } else {
            if (nextIndex !== entry.index) {
                rerenderKeys.add(entry.key);
            }
            entry.index = nextIndex;
            nextEntries.set(nextIndex, entry);
        }
    }
    return nextEntries;
}

function transformRange(
    range: { end: number; start: number } | undefined,
    operations: readonly DataSourceOperation[],
    length: number,
) {
    let nextRange: { end: number; start: number } | undefined;
    if (range && length > 0) {
        const first = Math.min(length - 1, Math.max(0, transformDataSourceIndex(range.start, operations)));
        const second = Math.min(length - 1, Math.max(0, transformDataSourceIndex(range.end, operations)));
        nextRange = {
            end: Math.min(length - 1, Math.max(first, second)),
            start: Math.max(0, Math.min(first, second)),
        };
    }
    return nextRange;
}

function updateViewabilityState(
    ctx: StateContext,
    source: LegendListDataSource<unknown>,
    nextIndexByKey: Map<string, number>,
    operations: readonly DataSourceOperation[],
) {
    const sourceLength = source.getLength();
    const transformViewabilityIndex = (index: number) =>
        index < 0 || sourceLength === 0
            ? -1
            : Math.min(sourceLength - 1, Math.max(0, transformDataSourceIndex(index, operations)));
    for (const [configId, viewabilityState] of ctx.mapViewabilityConfigStates) {
        const changed: ViewToken[] = [];
        const viewableItems: ViewToken[] = [];
        for (const token of viewabilityState.viewableItems) {
            const index = nextIndexByKey.get(token.key);
            if (index === undefined) {
                const removedToken = { ...token, isViewable: false };
                changed.push(removedToken);
                const callbackKey = token.containerId + configId;
                ctx.mapViewabilityValues.set(callbackKey, removedToken);
                ctx.mapViewabilityCallbacks.get(callbackKey)?.(removedToken);
            } else {
                const item = source.getItem(index);
                const nextToken = { ...token, index, item };
                viewableItems.push(nextToken);
                if (index !== token.index || item !== token.item) {
                    const callbackKey = token.containerId + configId;
                    ctx.mapViewabilityValues.set(callbackKey, nextToken);
                    ctx.mapViewabilityCallbacks.get(callbackKey)?.(nextToken);
                }
            }
        }

        if (changed.length > 0) {
            const pair = ctx.state.viewabilityConfigCallbackPairs?.find(
                (candidate) => candidate.viewabilityConfig.id === configId,
            );
            pair?.onViewableItemsChanged?.({
                changed,
                end: viewabilityState.end,
                endBuffered: viewabilityState.endBuffered,
                start: viewabilityState.start,
                startBuffered: viewabilityState.startBuffered,
                viewableItems,
            });
        }
        viewabilityState.viewableItems = viewableItems;
        viewabilityState.start = transformViewabilityIndex(viewabilityState.start);
        viewabilityState.end = transformViewabilityIndex(viewabilityState.end);
        viewabilityState.startBuffered = transformViewabilityIndex(viewabilityState.startBuffered);
        viewabilityState.endBuffered = transformViewabilityIndex(viewabilityState.endBuffered);
    }

    for (const [containerId, token] of ctx.mapViewabilityAmountValues) {
        const index = nextIndexByKey.get(token.key);
        if (index === undefined) {
            const removedToken = { ...token, isViewable: false, sizeVisible: -1 };
            ctx.mapViewabilityAmountValues.set(containerId, removedToken);
            ctx.mapViewabilityAmountCallbacks.get(containerId)?.(removedToken);
        } else if (index !== token.index || source.getItem(index) !== token.item) {
            ctx.mapViewabilityAmountValues.delete(containerId);
        }
    }
}

export function applyDataSourceMutationBatches(
    ctx: StateContext,
    source: LegendListDataSource<unknown>,
    batches: readonly DataSourceMutationBatch[],
): DataSourceMutationResult {
    const state = ctx.state;
    const operations = batches.flatMap((batch) => batch.operations);
    const explicitReset = operations.some((operation) => operation.type === "reset");
    if (explicitReset) {
        return { applied: false, materializedCount: 0, resetReason: "the data source requested a reset" };
    }

    let entries = collectMaterializedEntries(ctx);
    const anchorPositions = snapshotAnchorPositions(ctx);
    const invalidatedKeys = new Set<string>();
    const removedKeys = new Set<string>();
    const rerenderKeys = new Set<string>();
    for (const operation of operations) {
        entries = applyOperationToEntries(entries, operation, invalidatedKeys, rerenderKeys, removedKeys);
    }

    let resetReason: string | undefined;
    const nextIndexByKey = new Map<string, number>();
    try {
        for (const entry of entries.values()) {
            const finalKey = source.getKey(entry.index);
            if (finalKey !== entry.key) {
                resetReason = `materialized key ${entry.key} changed at index ${entry.index}`;
                break;
            }
            if (nextIndexByKey.has(entry.key)) {
                resetReason = `materialized key ${entry.key} is duplicated`;
                break;
            }
            nextIndexByKey.set(entry.key, entry.index);
        }
    } catch (error) {
        resetReason = `reading a materialized key failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    if (resetReason) {
        return { applied: false, materializedCount: entries.size, resetReason };
    }

    const layoutStore = state.layoutStoreRuntime?.store;
    if (layoutStore) {
        for (const operation of operations) {
            if (operation.type === "splice") {
                layoutStore.splice(operation.index, operation.deleteCount, operation.insertCount);
            } else if (operation.type === "move") {
                layoutStore.move(operation.from, operation.to, operation.count);
            } else if (operation.type === "update" && operation.layout === "invalidate") {
                layoutStore.invalidateRange(operation.index, operation.count);
            }
        }
    }

    if (state.props.overrideItemLayout && state.props.numColumns > 1) {
        let spanInvalidationIndex = state.dataSourceSpanInvalidationIndex;
        for (const operation of operations) {
            let operationIndex: number | undefined;
            if (operation.type === "splice") {
                operationIndex = operation.index;
            } else if (operation.type === "move") {
                operationIndex = Math.min(operation.from, operation.to);
            } else if (operation.type === "update" && operation.layout === "invalidate") {
                operationIndex = operation.index;
            }
            if (operationIndex !== undefined) {
                spanInvalidationIndex = Math.min(spanInvalidationIndex ?? operationIndex, operationIndex);
            }
        }
        state.dataSourceSpanInvalidationIndex = spanInvalidationIndex;
        state.layoutStoreRuntime?.transformCachedRowSpans(operations);
    }

    state.dataSourceAnchorPositions ??= anchorPositions;
    state.idCache.length = 0;
    state.indexByKey.clear();
    for (const entry of entries.values()) {
        state.idCache[entry.index] = entry.key;
        state.indexByKey.set(entry.key, entry.index);
    }

    for (const key of removedKeys) {
        state.sizes.delete(key);
        state.sizesKnown.delete(key);
        state.containerItemKeys.delete(key);
        state.pendingLayoutEffectMeasurements?.delete(key);
        state.userScrollAnchorReset?.keys.delete(key);
        state.layoutStoreRuntime?.positionListenerOffsets?.delete(key);
        notifyPosition$(ctx, key, undefined);
    }
    for (const key of invalidatedKeys) {
        state.sizes.delete(key);
        state.sizesKnown.delete(key);
    }

    for (const key of rerenderKeys) {
        const containerId = state.containerItemKeys.get(key);
        const index = nextIndexByKey.get(key);
        if (containerId !== undefined && index !== undefined) {
            set$(ctx, `containerItemData${containerId}`, source.getItem(index));
            const versionKey = `containerDataVersion${containerId}` as const;
            set$(ctx, versionKey, (peek$(ctx, versionKey) ?? 0) + 1);
        }
    }

    updateViewabilityState(ctx, source, nextIndexByKey, operations);
    state.idsInView = state.idsInView.filter((key) => nextIndexByKey.has(key));
    if (state.lastFirstVisibleItemCallback) {
        const index = nextIndexByKey.get(state.lastFirstVisibleItemCallback.key);
        state.lastFirstVisibleItemCallback =
            index === undefined ? undefined : { ...state.lastFirstVisibleItemCallback, index };
    }

    const finalLength = batches.at(-1)?.length ?? source.getLength();
    const transformClampedIndex = (index: number) =>
        finalLength > 0 ? Math.min(finalLength - 1, Math.max(0, transformDataSourceIndex(index, operations))) : 0;
    const activeStickyIndex = peek$(ctx, "activeStickyIndex");
    if (activeStickyIndex >= 0) {
        set$(ctx, "activeStickyIndex", finalLength > 0 ? transformClampedIndex(activeStickyIndex) : -1);
    }
    state.scrollTargetPinnedRange = transformRange(state.scrollTargetPinnedRange, operations, finalLength);
    if (state.scrollingTo?.index !== undefined) {
        state.scrollingTo.index = transformClampedIndex(state.scrollingTo.index);
    }
    if (state.initialScroll?.index !== undefined) {
        state.initialScroll.index = transformClampedIndex(state.initialScroll.index);
    }
    const bootstrap =
        state.initialScrollSession?.kind === "bootstrap" ? state.initialScrollSession.bootstrap : undefined;
    if (bootstrap?.targetIndexSeed !== undefined) {
        bootstrap.targetIndexSeed = transformClampedIndex(bootstrap.targetIndexSeed);
    }
    if (bootstrap?.visibleIndices) {
        bootstrap.visibleIndices = bootstrap.visibleIndices.map(transformClampedIndex);
    }

    state.startBuffered = finalLength > 0 ? transformClampedIndex(state.startBuffered) : -1;
    state.endBuffered = finalLength > 0 ? transformClampedIndex(state.endBuffered) : -1;
    state.startNoBuffer =
        state.startNoBuffer === null || finalLength === 0 ? null : transformClampedIndex(state.startNoBuffer);
    state.endNoBuffer =
        state.endNoBuffer === null || finalLength === 0 ? null : transformClampedIndex(state.endNoBuffer);
    state.firstFullyOnScreenIndex =
        state.firstFullyOnScreenIndex === undefined ? undefined : transformClampedIndex(state.firstFullyOnScreenIndex);
    state.scrollForNextCalculateItemsInView = undefined;

    return { applied: true, materializedCount: entries.size };
}
