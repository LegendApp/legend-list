import { POSITION_OUT_OF_VIEW } from "@/constants";
import { IsNewArchitecture } from "@/constants-platform";
import { finalizeDataChange } from "@/core/finalizeDataChange";
import { setSize } from "@/core/setSize";
import { assignContainerItem, getRequiredItemTypes, syncContainerPoolSize } from "@/core/updateContainerState";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext, set$ } from "@/state/state";
import { findAvailableContainers } from "@/utils/findAvailableContainers";
import { roundSize } from "@/utils/helpers";
import { requestAdjust } from "@/utils/requestAdjust";
import { updateAveragesOnDataChange } from "@/utils/updateAveragesOnDataChange";

interface PrependCandidate {
    insertedCount: number;
    insertedKeys: string[];
    newIds: string[];
}

interface PrependInsertInfo extends PrependCandidate {
    estimatedInsertedTotal: number;
    estimatedPositions: number[];
    estimatedSizes: number[];
    knownInsertedKeys: Set<string>;
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

    if (!canStartPrependTransaction(ctx, state, previousData, dataProp, candidate.insertedCount)) {
        return false;
    }

    const info = estimatePrependInsertInfo(state, dataProp, candidate);
    if (!info) {
        return false;
    }

    updateAveragesOnDataChange(state, previousData!, dataProp);
    seedPrependEstimatedSizes(ctx, state, info);
    remapStateForPrepend(state, info);
    shiftMountedContainerPositions(ctx, info.estimatedInsertedTotal, new Set(info.insertedKeys));
    allocateMeasurementContainers(ctx, info, dataProp);

    const remainingKeys = new Set(info.insertedKeys.filter((key) => state.sizesKnown.get(key) === undefined));
    state.pendingPrependTransaction = {
        insertedKeys: new Set(info.insertedKeys),
        remainingKeys,
    };

    requestAdjust(ctx, info.estimatedInsertedTotal, true);

    if (remainingKeys.size === 0) {
        commitPrependTransaction(ctx);
    }

    return true;
}

export function handlePrependTransactionMeasurement(ctx: StateContext, itemKey: string) {
    const transaction = ctx.state.pendingPrependTransaction;
    if (!transaction || !transaction.insertedKeys.has(itemKey)) {
        return false;
    }

    transaction.remainingKeys.delete(itemKey);
    if (transaction.remainingKeys.size === 0) {
        commitPrependTransaction(ctx);
    }

    return true;
}

function commitPrependTransaction(ctx: StateContext) {
    const state = ctx.state;
    if (!state.pendingPrependTransaction) {
        return;
    }

    state.pendingPrependTransaction = undefined;
    finalizeDataChange(ctx);
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
    const oldIds = previousData.map((item, index) => keyExtractor(item, index));
    const newIds = dataProp.map((item, index) => keyExtractor(item, index));
    const isPrepend = oldIds.every((id, index) => newIds[index + insertedCount] === id);
    if (!isPrepend) {
        return undefined;
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

    const insertedKeys = newIds.slice(0, insertedCount);
    return {
        insertedCount,
        insertedKeys,
        newIds,
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
    const newLength = info.newIds.length;

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
    state.idCache = info.newIds.slice();
    state.indexByKey.clear();
    for (let index = 0; index < info.newIds.length; index++) {
        state.indexByKey.set(info.newIds[index], index);
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
    const state = ctx.state;
    const pendingRemoval: number[] = [];
    const insertedIndices = Array.from({ length: info.insertedCount }, (_, index) => index);
    const requiredItemTypes = getRequiredItemTypes(state, dataProp, insertedIndices);
    const availableContainers = findAvailableContainers(
        ctx,
        insertedIndices.length,
        state.startBuffered,
        state.endBuffered,
        pendingRemoval,
        requiredItemTypes,
        insertedIndices,
    );

    let numContainers = peek$(ctx, "numContainers") ?? 0;
    for (let idx = 0; idx < insertedIndices.length; idx++) {
        const index = insertedIndices[idx];
        const containerIndex = availableContainers[idx];
        assignContainerItem(ctx, {
            containerIndex,
            data: dataProp[index],
            itemKey: info.newIds[index],
            itemType: requiredItemTypes?.[idx],
            position: info.estimatedPositions[idx] ?? POSITION_OUT_OF_VIEW,
        });

        if (containerIndex >= numContainers) {
            numContainers = containerIndex + 1;
        }
    }

    syncContainerPoolSize(ctx, numContainers);
}
