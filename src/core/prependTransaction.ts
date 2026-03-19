import { POSITION_OUT_OF_VIEW } from "@/constants";
import { IsNewArchitecture } from "@/constants-platform";
import { calculateItemsInView } from "@/core/calculateItemsInView";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { setSize } from "@/core/setSize";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext, set$ } from "@/state/state";
import { checkThresholds } from "@/utils/checkThresholds";
import { findAvailableContainers } from "@/utils/findAvailableContainers";
import { roundSize } from "@/utils/helpers";
import { requestAdjust } from "@/utils/requestAdjust";
import { updateAveragesOnDataChange } from "@/utils/updateAveragesOnDataChange";

interface PrependCandidate {
    anchorKey: string;
    anchorViewportOffset: number;
    insertedCount: number;
    insertedIndices: number[];
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

    const blockers = getPrependTransactionBlockers(ctx, state, previousData, candidate);
    if (blockers.length > 0) {
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
    const transaction = state.pendingPrependTransaction;
    if (!transaction) {
        return;
    }

    state.pendingPrependTransaction = undefined;
    calculateItemsInView(ctx, { dataChanged: true, doMVCP: true });

    const { maintainScrollAtEnd, data } = state.props;
    const previousData = state.previousData;
    const didMaintainScrollAtEnd = maintainScrollAtEnd?.onDataChange ? doMaintainScrollAtEnd(ctx) : false;

    if (!didMaintainScrollAtEnd && previousData && data.length > previousData.length) {
        state.isEndReached = false;
    }

    if (!didMaintainScrollAtEnd) {
        checkThresholds(ctx);
    }

    delete state.previousData;
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

    const insertedIndices = Array.from({ length: insertedCount }, (_, index) => index);
    const insertedKeys = newIds.slice(0, insertedCount);
    return {
        anchorKey,
        anchorViewportOffset: anchorPosition - state.scroll,
        insertedCount,
        insertedIndices,
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
    insertedIndices: number[],
) {
    const { getFixedItemSize, getItemType } = state.props;
    if (!getFixedItemSize) {
        return false;
    }

    return insertedIndices.every((index) => {
        const item = dataProp[index];
        const itemType = getItemType ? (getItemType(item, index) ?? "") : "";
        return Number.isFinite(getFixedItemSize(item, index, itemType));
    });
}

function getPrependTransactionBlockers(
    ctx: StateContext,
    state: StateContext["state"],
    previousData: readonly unknown[] | undefined,
    info: PrependCandidate,
) {
    const blockers: string[] = [];

    const oldArchMissingFixedSizes =
        !IsNewArchitecture && !hasFixedSizesForInsertedItems(state, state.props.data, info.insertedIndices);
    const unsupportedWebMode = Platform.OS === "web" && !IsNewArchitecture;
    if (unsupportedWebMode || oldArchMissingFixedSizes) {
        blockers.push("unsupported-platform");
    }
    if (!previousData?.length || state.pendingPrependTransaction) {
        blockers.push(!previousData?.length ? "missing-previous-data" : "transaction-already-active");
    }
    if (
        !state.didContainersLayout ||
        !state.didFinishInitialScroll ||
        state.startBuffered < 0 ||
        state.endBuffered < 0
    ) {
        blockers.push("layout-or-initial-scroll-not-ready");
    }
    if (!peek$(ctx, "numContainers")) {
        blockers.push("no-containers");
    }
    if (
        state.props.numColumns !== 1 ||
        state.props.overrideItemLayout ||
        state.props.stickyIndicesArr.length > 0 ||
        state.props.alwaysRenderIndicesArr.length > 0
    ) {
        blockers.push("unsupported-list-config");
    }
    if (state.initialScroll || state.scrollingTo || state.pendingNativeMVCPAdjust) {
        blockers.push("scroll-state-not-settled");
    }

    const anchorIndex = state.indexByKey.get(info.anchorKey);
    if (anchorIndex === undefined) {
        blockers.push("missing-anchor-index");
    }

    return blockers;
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
    const requiredItemTypes = state.props.getItemType
        ? info.insertedIndices.map((index) => {
              const itemType = state.props.getItemType?.(dataProp[index], index);
              return itemType !== undefined ? String(itemType) : "";
          })
        : undefined;
    const availableContainers = findAvailableContainers(
        ctx,
        info.insertedIndices.length,
        state.startBuffered,
        state.endBuffered,
        pendingRemoval,
        requiredItemTypes,
        info.insertedIndices,
    );

    let numContainers = peek$(ctx, "numContainers") ?? 0;
    for (let idx = 0; idx < info.insertedIndices.length; idx++) {
        const index = info.insertedIndices[idx];
        const containerIndex = availableContainers[idx];
        const id = info.newIds[index];
        const oldKey = peek$(ctx, `containerItemKey${containerIndex}`);
        if (oldKey && oldKey !== id) {
            state.containerItemKeys.delete(oldKey);
        }

        state.containerItemKeys.set(id, containerIndex);
        if (requiredItemTypes) {
            state.containerItemTypes.set(containerIndex, requiredItemTypes[idx]);
        }

        set$(ctx, `containerItemKey${containerIndex}`, id);
        set$(ctx, `containerItemData${containerIndex}`, dataProp[index]);
        set$(ctx, `containerPosition${containerIndex}`, info.estimatedPositions[idx] ?? POSITION_OUT_OF_VIEW);
        set$(ctx, `containerColumn${containerIndex}`, -1);
        set$(ctx, `containerSpan${containerIndex}`, 1);
        if (peek$(ctx, `containerSticky${containerIndex}`)) {
            set$(ctx, `containerSticky${containerIndex}`, false);
        }
        state.stickyContainerPool.delete(containerIndex);

        if (containerIndex >= numContainers) {
            numContainers = containerIndex + 1;
        }
    }

    if (numContainers !== peek$(ctx, "numContainers")) {
        set$(ctx, "numContainers", numContainers);
        if (numContainers > (peek$(ctx, "numContainersPooled") ?? 0)) {
            set$(ctx, "numContainersPooled", Math.ceil(numContainers * 1.5));
        }
    }
}
