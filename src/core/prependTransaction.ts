import { POSITION_OUT_OF_VIEW } from "@/constants";
import { IsNewArchitecture } from "@/constants-platform";
import { ensureDeferredGeometryState } from "@/core/deferredPositionState";
import { finalizeDataChangeSideEffects, reconcileDataChange } from "@/core/finalizeDataChange";
import { cancelInitialBootstrap, isInitialBootstrapActive } from "@/core/initialBootstrap";
import { supportsDeferredGeometryOptimization } from "@/core/scrollOwnership";
import { setSize } from "@/core/setSize";
import { allocateContainersForIndices } from "@/core/updateContainerState";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext, set$ } from "@/state/state";
import { logInitialScrollDebug } from "@/utils/debugInitialScroll";
import { roundSize } from "@/utils/helpers";
import { requestAdjust } from "@/utils/requestAdjust";
import { updateAveragesOnDataChange } from "@/utils/updateAveragesOnDataChange";

interface PrependCandidate {
    anchorIndex: number;
    anchorKey: string;
    anchorPosition: number;
    insertedCount: number;
    insertedKeys: string[];
    previousIds: string[];
}

interface PrependInsertInfo extends PrependCandidate {
    estimatedInsertedTotal: number;
    estimatedPositions: number[];
    estimatedSizes: number[];
    knownInsertedKeys: Set<string>;
    usesDeferredGeometry: boolean;
}

function getMeasuredInsertedTotal(state: StateContext["state"], insertedKeys: Iterable<string>) {
    let total = 0;
    let measuredCount = 0;

    for (const key of insertedKeys) {
        const size = state.sizesKnown.get(key);
        if (size !== undefined) {
            total += size;
            measuredCount++;
        }
    }

    return { measuredCount, total };
}

export function startPrependTransaction(
    ctx: StateContext,
    previousData: readonly unknown[] | undefined,
    dataProp: readonly unknown[],
) {
    const state = ctx.state;
    const candidate = detectPurePrepend(state, previousData, dataProp);
    if (!candidate) {
        return false;
    }

    if (isInitialBootstrapActive(state)) {
        cancelInitialBootstrap(ctx);
    }

    if (!canStartPrependTransaction(ctx, state, previousData, dataProp, candidate.insertedCount)) {
        return false;
    }

    const info = estimatePrependInsertInfo(state, dataProp, candidate);
    if (!info) {
        return false;
    }

    logInitialScrollDebug("prepend-transaction-start", {
        anchorIndex: candidate.anchorIndex,
        anchorKey: candidate.anchorKey,
        anchorPosition: candidate.anchorPosition,
        estimatedInsertedTotal: info.estimatedInsertedTotal,
        insertedCount: info.insertedCount,
        insertedKeys: info.insertedKeys.slice(0, 5),
        idsInView: state.idsInView.slice(0, 5),
        previousFirstId: candidate.previousIds[0],
        scroll: state.scroll,
    });

    updateAveragesOnDataChange(state, previousData!, dataProp);
    seedPrependEstimatedSizes(ctx, state, info);
    remapStateForPrepend(state, info);
    logInitialScrollDebug("prepend-transaction-remap", {
        anchorIndexAfterRemap: info.anchorIndex + info.insertedCount,
        anchorIndexBeforeRemap: info.anchorIndex,
        anchorKey: info.anchorKey,
        anchorPositionAfterRemap: state.positions[info.anchorIndex + info.insertedCount],
        anchorPositionBeforeRemap: info.anchorPosition,
        endBuffered: state.endBuffered,
        endNoBuffer: state.endNoBuffer,
        estimatedInsertedTotal: info.estimatedInsertedTotal,
        insertedCount: info.insertedCount,
        scroll: state.scroll,
        startBuffered: state.startBuffered,
        startNoBuffer: state.startNoBuffer,
    });
    shiftMountedContainerPositions(ctx, info.estimatedInsertedTotal, new Set(info.insertedKeys));
    allocateMeasurementContainers(ctx, info, dataProp);

    const remainingKeys = new Set(info.insertedKeys.filter((key) => state.sizesKnown.get(key) === undefined));
    state.pendingPrependTransaction = {
        anchorIndex: info.anchorIndex,
        anchorKey: info.anchorKey,
        anchorPosition: info.anchorPosition,
        estimatedInsertedTotal: info.estimatedInsertedTotal,
        insertedKeys: new Set(info.insertedKeys),
        remainingKeys,
        usesDeferredGeometry: info.usesDeferredGeometry,
    };

    logInitialScrollDebug("prepend-transaction-adjust-request", {
        adjustPendingBefore: ctx.values.get("scrollAdjustPending"),
        anchorIndex: info.anchorIndex,
        anchorKey: info.anchorKey,
        anchorPosition: info.anchorPosition,
        deferredDeltaBefore: state.deferredGeometry.delta,
        estimatedInsertedTotal: info.estimatedInsertedTotal,
        insertedCount: info.insertedCount,
        remainingKeys: remainingKeys.size,
        scroll: state.scroll,
        scrollAdjustBefore: state.scrollAdjustHandler.getAdjust(),
        usesDeferredGeometry: info.usesDeferredGeometry,
    });
    if (info.usesDeferredGeometry) {
        const deferredGeometry = ensureDeferredGeometryState(state);
        deferredGeometry.delta += info.estimatedInsertedTotal;
    } else {
        requestAdjust(ctx, info.estimatedInsertedTotal, true);
    }

    if (remainingKeys.size === 0) {
        commitPrependTransaction(ctx);
    }

    return true;
}

export function handlePrependTransactionMeasurement(ctx: StateContext, itemKey: string) {
    const state = ctx.state;
    const transaction = state.pendingPrependTransaction;
    if (!transaction || !transaction.insertedKeys.has(itemKey)) {
        return { committed: false, handled: false, usesDeferredGeometry: false };
    }

    transaction.remainingKeys.delete(itemKey);
    const { measuredCount, total: measuredInsertedTotal } = getMeasuredInsertedTotal(state, transaction.insertedKeys);
    logInitialScrollDebug("prepend-transaction-measurement", {
        anchorIndexAfterRemap: transaction.anchorIndex + transaction.insertedKeys.size,
        anchorKey: transaction.anchorKey,
        anchorPositionBeforePrepend: transaction.anchorPosition,
        deferredDelta: state.deferredGeometry.delta,
        estimatedInsertedTotal: transaction.estimatedInsertedTotal,
        itemKey,
        measuredInsertedCount: measuredCount,
        measuredInsertedTotal,
        remainingKeys: transaction.remainingKeys.size,
        scroll: state.scroll,
        scrollAdjust: state.scrollAdjustHandler.getAdjust(),
        size: state.sizesKnown.get(itemKey),
        usesDeferredGeometry: transaction.usesDeferredGeometry,
    });
    if (transaction.remainingKeys.size === 0) {
        commitPrependTransaction(ctx);
        return { committed: true, handled: true, usesDeferredGeometry: !!transaction.usesDeferredGeometry };
    }

    return { committed: false, handled: true, usesDeferredGeometry: !!transaction.usesDeferredGeometry };
}

function commitPrependTransaction(ctx: StateContext) {
    const state = ctx.state;
    const transaction = state.pendingPrependTransaction;
    if (!transaction) {
        return;
    }

    const { measuredCount, total: measuredInsertedTotal } = getMeasuredInsertedTotal(state, transaction.insertedKeys);
    logInitialScrollDebug("prepend-transaction-commit", {
        adjustPending: ctx.values.get("scrollAdjustPending"),
        anchorIndex: transaction.anchorIndex,
        anchorKey: transaction.anchorKey,
        anchorPositionBeforePrepend: transaction.anchorPosition,
        anchorPositionCurrent:
            state.positions[(state.indexByKey.get(transaction.anchorKey) ?? transaction.anchorIndex)],
        deferredDelta: state.deferredGeometry.delta,
        estimatedInsertedTotal: transaction.estimatedInsertedTotal,
        insertedCount: transaction.insertedKeys.size,
        measuredInsertedCount: measuredCount,
        measuredInsertedTotal,
        remainingKeys: transaction.remainingKeys.size,
        scroll: state.scroll,
        scrollAdjust: state.scrollAdjustHandler.getAdjust(),
        usesDeferredGeometry: transaction.usesDeferredGeometry,
    });
    state.pendingPrependTransaction = undefined;
    if (transaction.usesDeferredGeometry) {
        state.minIndexSizeChanged = 0;
        state.scrollForNextCalculateItemsInView = undefined;
        finalizeDataChangeSideEffects(ctx);
        state.triggerCalculateItemsInView?.({});
        return;
    }

    reconcileDataChange(ctx);
    finalizeDataChangeSideEffects(ctx);
}

function detectPurePrepend(
    state: StateContext["state"],
    previousData: readonly unknown[] | undefined,
    dataProp: readonly unknown[],
): PrependCandidate | undefined {
    const keyExtractor = state.props.keyExtractor;
    if (!previousData || !keyExtractor || dataProp.length <= previousData.length) {
        return undefined;
    }

    const oldLength = previousData.length;
    const insertedCount = dataProp.length - oldLength;
    const previousIds = previousData.map((item, index) => keyExtractor(item, index));
    const insertedKeys = Array<string>(insertedCount);
    for (let index = 0; index < dataProp.length; index++) {
        const id = keyExtractor(dataProp[index], index);
        if (index < insertedCount) {
            insertedKeys[index] = id;
        } else if (id !== previousIds[index - insertedCount]) {
            return undefined;
        }
    }

    const anchorKey = getFrozenAnchorKey(state, previousData, keyExtractor);
    if (!anchorKey) {
        return undefined;
    }
    const anchorIndex = state.indexByKey.get(anchorKey);
    if (anchorIndex === undefined) {
        return undefined;
    }
    const anchorPosition = state.positions[anchorIndex];
    if (anchorPosition === undefined || !Number.isFinite(anchorPosition)) {
        return undefined;
    }

    return {
        anchorIndex,
        anchorKey,
        anchorPosition,
        insertedCount,
        insertedKeys,
        previousIds,
    };
}

function estimatePrependInsertInfo(
    state: StateContext["state"],
    dataProp: readonly unknown[],
    candidate: PrependCandidate,
): PrependInsertInfo | undefined {
    const estimatedPositions: number[] = [];
    const estimatedSizes: number[] = [];
    const knownInsertedKeys = new Set<string>();
    let estimatedInsertedTotal = 0;

    for (let i = 0; i < candidate.insertedCount; i++) {
        const estimatedSize = estimatePrependItemSize(state, candidate.insertedKeys[i], i, dataProp[i]);
        if (estimatedSize === undefined) {
            return undefined;
        }

        estimatedPositions.push(estimatedInsertedTotal);
        estimatedSizes.push(estimatedSize.size);
        estimatedInsertedTotal += estimatedSize.size;

        if (estimatedSize.isKnown) {
            knownInsertedKeys.add(candidate.insertedKeys[i]);
        }
    }

    return {
        ...candidate,
        estimatedInsertedTotal,
        estimatedPositions,
        estimatedSizes,
        knownInsertedKeys,
        usesDeferredGeometry: supportsDeferredGeometryOptimization(state, state.props.numColumns),
    };
}

function estimatePrependItemSize(
    state: StateContext["state"],
    key: string,
    index: number,
    data: unknown,
): { isKnown: boolean; size: number } | undefined {
    const {
        averageSizes,
        props: { estimatedItemSize, getEstimatedItemSize, getFixedItemSize, getItemType },
        scrollingTo,
        sizes,
        sizesKnown,
    } = state;
    const knownSize = sizesKnown.get(key);
    if (knownSize !== undefined) {
        return { isKnown: true, size: knownSize };
    }

    const cachedSize = sizes.get(key);
    if (cachedSize !== undefined) {
        return { isKnown: false, size: cachedSize };
    }

    const itemType = getItemType ? (getItemType(data, index) ?? "") : "";

    if (getFixedItemSize) {
        const fixedSize = getFixedItemSize(data, index, itemType);
        if (fixedSize !== undefined) {
            return { isKnown: true, size: fixedSize };
        }
    }

    if (!getEstimatedItemSize && !scrollingTo) {
        const averageSizeForType = averageSizes[itemType]?.avg;
        if (averageSizeForType !== undefined) {
            return { isKnown: false, size: roundSize(averageSizeForType) };
        }
    }

    const estimatedSize = getEstimatedItemSize ? getEstimatedItemSize(data, index, itemType) : estimatedItemSize;
    return estimatedSize !== undefined && Number.isFinite(estimatedSize)
        ? { isKnown: false, size: roundSize(estimatedSize) }
        : undefined;
}

function getFrozenAnchorKey(
    state: StateContext["state"],
    previousData: readonly unknown[],
    keyExtractor: NonNullable<StateContext["state"]["props"]["keyExtractor"]>,
) {
    for (const id of state.idsInView) {
        if (state.indexByKey.get(id) !== undefined) {
            return id;
        }
    }

    const anchorIndex = state.firstFullyOnScreenIndex >= 0 ? state.firstFullyOnScreenIndex : state.startNoBuffer;
    if (anchorIndex < 0 || anchorIndex >= previousData.length) {
        return undefined;
    }

    return state.idCache[anchorIndex] ?? keyExtractor(previousData[anchorIndex], anchorIndex);
}

function hasFixedSizesForInsertedItems(
    state: StateContext["state"],
    dataProp: readonly unknown[],
    insertedCount: number,
) {
    const { getFixedItemSize, getItemType } = state.props;
    if (!getFixedItemSize) {
        return false;
    }

    for (let index = 0; index < insertedCount; index++) {
        const item = dataProp[index];
        const itemType = getItemType ? (getItemType(item, index) ?? "") : "";
        if (!Number.isFinite(getFixedItemSize(item, index, itemType))) {
            return false;
        }
    }

    return true;
}

function canStartPrependTransaction(
    ctx: StateContext,
    state: StateContext["state"],
    previousData: readonly unknown[] | undefined,
    dataProp: readonly unknown[],
    insertedCount: number,
) {
    const oldArchMissingFixedSizes =
        !IsNewArchitecture && !hasFixedSizesForInsertedItems(state, dataProp, insertedCount);
    const unsupportedWebMode = Platform.OS === "web" && !IsNewArchitecture;
    return !(
        unsupportedWebMode ||
        oldArchMissingFixedSizes ||
        !previousData?.length ||
        state.pendingPrependTransaction ||
        !state.didContainersLayout ||
        !state.didFinishInitialScroll ||
        state.startBuffered < 0 ||
        state.endBuffered < 0 ||
        !peek$(ctx, "numContainers") ||
        state.props.numColumns !== 1 ||
        state.props.overrideItemLayout ||
        state.props.stickyIndicesArr.length > 0 ||
        state.props.alwaysRenderIndicesArr.length > 0 ||
        state.initialScroll ||
        state.scrollingTo ||
        state.pendingNativeMVCPAdjust
    );
}

function seedPrependEstimatedSizes(ctx: StateContext, state: StateContext["state"], info: PrependInsertInfo) {
    for (let i = 0; i < info.insertedKeys.length; i++) {
        const key = info.insertedKeys[i];
        const size = info.estimatedSizes[i];
        setSize(ctx, key, size);

        if (info.knownInsertedKeys.has(key)) {
            state.sizesKnown.set(key, size);
        }
    }
}

function remapStateForPrepend(state: StateContext["state"], info: PrependInsertInfo) {
    const offset = info.insertedCount;
    const oldPositions = state.positions.slice();
    const oldColumns = state.columns.slice();
    const oldColumnSpans = state.columnSpans.slice();
    const nextIds = info.insertedKeys.concat(info.previousIds);
    const newLength = nextIds.length;

    const nextPositions = Array<number | undefined>(newLength).fill(undefined);
    const nextColumns = Array<number | undefined>(newLength).fill(undefined);
    const nextColumnSpans = Array<number | undefined>(newLength).fill(undefined);

    for (let i = 0; i < offset; i++) {
        nextPositions[i] = info.estimatedPositions[i];
    }

    for (let nextIndex = offset; nextIndex < newLength; nextIndex++) {
        const oldIndex = nextIndex - offset;
        const oldPosition = oldPositions[oldIndex];
        nextPositions[nextIndex] = oldPosition === undefined ? undefined : oldPosition + info.estimatedInsertedTotal;
        nextColumns[nextIndex] = oldColumns[oldIndex];
        nextColumnSpans[nextIndex] = oldColumnSpans[oldIndex];
    }

    state.positions = nextPositions;
    state.columns = nextColumns;
    state.columnSpans = nextColumnSpans;
    state.idCache = nextIds;
    state.indexByKey.clear();
    for (let index = 0; index < nextIds.length; index++) {
        state.indexByKey.set(nextIds[index], index);
    }

    state.startBuffered += offset;
    state.endBuffered += offset;
    state.startNoBuffer += offset;
    state.endNoBuffer += offset;
    if (state.firstFullyOnScreenIndex >= 0) {
        state.firstFullyOnScreenIndex += offset;
    }

    state.scrollForNextCalculateItemsInView = undefined;
    state.minIndexSizeChanged = undefined;
}

function shiftMountedContainerPositions(ctx: StateContext, compensation: number, insertedKeys: Set<string>) {
    if (compensation === 0) {
        return;
    }

    const numContainers = peek$(ctx, "numContainers") ?? 0;
    for (let i = 0; i < numContainers; i++) {
        const key = peek$(ctx, `containerItemKey${i}`);
        if (!key || insertedKeys.has(key)) {
            continue;
        }

        const position = peek$(ctx, `containerPosition${i}`);
        if (position !== undefined && Number.isFinite(position) && position > POSITION_OUT_OF_VIEW) {
            set$(ctx, `containerPosition${i}`, position + compensation);
        }
    }
}

function allocateMeasurementContainers(ctx: StateContext, info: PrependInsertInfo, dataProp: readonly unknown[]) {
    const pendingRemoval: number[] = [];
    const insertedIndices = Array.from({ length: info.insertedCount }, (_, index) => index);
    allocateContainersForIndices(ctx, {
        data: dataProp,
        endBuffered: ctx.state.endBuffered,
        indices: insertedIndices,
        pendingRemoval,
        resolveAssignment: ({ index }) => ({
            position: info.estimatedPositions[index] ?? POSITION_OUT_OF_VIEW,
        }),
        startBuffered: ctx.state.startBuffered,
    });
}
