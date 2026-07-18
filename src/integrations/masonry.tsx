import * as React from "react";

import { LegendList, type LegendListProps, type LegendListRef } from "@legendapp/list/react-native";

type MasonryLegendListProps<ItemT = any> = Omit<LegendListProps<ItemT>, "horizontal" | "overrideItemLayout"> & {
    numColumns: number;
};

type MasonryLegendListComponentType = <ItemT = any>(
    props: MasonryLegendListProps<ItemT> & React.RefAttributes<LegendListRef>,
) => React.ReactElement | null;

type MasonryLayoutState = {
    columns: number[];
    columnSpans: number[];
    idCache: string[];
    indexByKey: Map<string, number>;
    positions: number[];
    props: {
        data: readonly unknown[];
    };
    scrollAdjustHandler: {
        getAdjust: () => number;
    };
    scrollingTo?: unknown;
    sizesKnown: Map<string, number>;
};

type MasonryLayoutContext = {
    positionListeners: {
        size: number;
    };
    state: MasonryLayoutState;
    values: {
        get: (key: string) => unknown;
    };
};

type MasonryLayoutDependencies = {
    getId: (state: MasonryLayoutState, index: number) => string;
    getItemSize: (
        ctx: MasonryLayoutContext,
        key: string,
        index: number,
        item: unknown,
        useAverageSize?: boolean,
        preferCachedSize?: boolean,
        notifyTotalSize?: boolean,
    ) => number;
    getScrollVelocity: (state: MasonryLayoutState) => number;
    isDev: boolean;
    notifyPosition: (ctx: MasonryLayoutContext, key: string, position: number) => void;
    setTotalSize: (ctx: MasonryLayoutContext, totalSize: number) => void;
};

function updateMasonryItemPositions(
    ctx: MasonryLayoutContext,
    dataChanged: boolean | undefined,
    options: {
        doMVCP?: boolean;
        forceFullUpdate?: boolean;
        optimizeForVisibleWindow?: boolean;
        scrollBottomBuffered: number;
        scrollVelocity?: number;
        startIndex: number;
    },
    dependencies: MasonryLayoutDependencies,
) {
    const state = ctx.state;
    const {
        columns,
        columnSpans,
        idCache,
        indexByKey,
        positions,
        props: { data },
        sizesKnown,
    } = state;
    const dataLength = data.length;
    const numColumnsValue = ctx.values.get("numColumns");
    const numColumns =
        typeof numColumnsValue === "number" && Number.isFinite(numColumnsValue)
            ? Math.max(1, Math.floor(numColumnsValue))
            : 1;
    const pendingScrollAdjust = ctx.values.get("scrollAdjustPending");
    const useAverageSize = true;
    const preferCachedSize =
        !options.doMVCP ||
        dataChanged ||
        state.scrollAdjustHandler.getAdjust() !== 0 ||
        (typeof pendingScrollAdjust === "number" ? pendingScrollAdjust : 0) !== 0;
    const notifyTotalSizeWhileCachingSizes = false;

    if (dataLength === 0) {
        columns.length = 0;
        columnSpans.length = 0;
        positions.length = 0;
        dependencies.setTotalSize(ctx, 0);
        return;
    }

    let startIndex = options.forceFullUpdate || dataChanged ? 0 : Math.max(0, options.startIndex);
    const columnHeights = Array<number>(numColumns).fill(0);

    if (startIndex > 0) {
        const foundColumns = new Set<number>();
        for (let index = startIndex - 1; index >= 0 && foundColumns.size < numColumns; index--) {
            const column = columns[index];
            const position = positions[index];
            if (column === undefined || position === undefined) {
                startIndex = 0;
                columnHeights.fill(0);
                break;
            }
            if (!foundColumns.has(column)) {
                const key = idCache[index] ?? dependencies.getId(state, index);
                const size =
                    sizesKnown.get(key) ??
                    dependencies.getItemSize(
                        ctx,
                        key,
                        index,
                        data[index],
                        useAverageSize,
                        preferCachedSize,
                        notifyTotalSizeWhileCachingSizes,
                    );
                columnHeights[column - 1] = position + size;
                foundColumns.add(column);
            }
        }
    }

    const hasPositionListeners = ctx.positionListeners.size > 0;
    const needsIndexByKey = dataChanged || indexByKey.size === 0;
    const indexByKeyForChecking = dependencies.isDev && needsIndexByKey ? new Map<string, number>() : undefined;
    const velocity = options.scrollVelocity ?? dependencies.getScrollVelocity(state);
    const shouldOptimize =
        !options.forceFullUpdate && !dataChanged && (options.optimizeForVisibleWindow || Math.abs(velocity) > 0);
    const maxVisibleArea = options.scrollBottomBuffered + 1000;
    let breakAt: number | undefined;
    let didBreakEarly = false;

    for (let index = startIndex; index < dataLength; index++) {
        if (shouldOptimize && breakAt !== undefined && index > breakAt) {
            didBreakEarly = true;
            break;
        }

        let columnIndex = 0;
        let position = columnHeights[0];
        for (let candidate = 1; candidate < numColumns; candidate++) {
            if (columnHeights[candidate] < position) {
                columnIndex = candidate;
                position = columnHeights[candidate];
            }
        }

        if (
            shouldOptimize &&
            breakAt === undefined &&
            !state.scrollingTo &&
            !dataChanged &&
            position > maxVisibleArea
        ) {
            breakAt = index + numColumns + 10;
        }

        const key = idCache[index] ?? dependencies.getId(state, index);
        const size =
            sizesKnown.get(key) ??
            dependencies.getItemSize(
                ctx,
                key,
                index,
                data[index],
                useAverageSize,
                preferCachedSize,
                notifyTotalSizeWhileCachingSizes,
            );

        if (indexByKeyForChecking) {
            if (indexByKeyForChecking.has(key)) {
                console.error(
                    `[legend-list] Error: Detected overlapping key (${key}) which causes missing items and gaps and other terrrible things. Check that keyExtractor returns unique values.`,
                );
            }
            indexByKeyForChecking.set(key, index);
        }

        if (positions[index] !== position) {
            positions[index] = position;
            if (hasPositionListeners) {
                dependencies.notifyPosition(ctx, key, position);
            }
        }
        columns[index] = columnIndex + 1;
        columnSpans[index] = 1;
        columnHeights[columnIndex] = position + size;

        if (needsIndexByKey) {
            indexByKey.set(key, index);
        }
    }

    if (!didBreakEarly) {
        dependencies.setTotalSize(ctx, Math.max(...columnHeights));
    }
}

const MasonryLegendList = React.forwardRef(function MasonryLegendListComponent<ItemT>(
    { numColumns, ...rest }: MasonryLegendListProps<ItemT>,
    ref: React.ForwardedRef<LegendListRef>,
) {
    const resolvedNumColumns = Number.isFinite(numColumns) ? Math.max(1, Math.floor(numColumns)) : 1;

    return (
        <LegendList
            {...rest}
            {...({ layoutStrategyInternal: updateMasonryItemPositions } as any)}
            horizontal={false}
            numColumns={resolvedNumColumns}
            overrideItemLayout={undefined}
            ref={ref}
        />
    );
}) as MasonryLegendListComponentType;

export { MasonryLegendList };
export type { MasonryLegendListProps };
