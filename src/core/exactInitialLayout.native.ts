import { Platform } from "@/platform/Platform";
import { peek$, type StateContext, set$, useStateContext } from "@/state/state";
import type {
    ColumnWrapperStyle,
    Insets,
    LayoutRectangle,
    LegendListPropsBase,
    ScrollIndexWithOffsetAndContentOffset,
} from "@/types.base";
import type { ExactInitialLayoutSnapshot } from "@/types.internal";
import { IS_DEV } from "@/utils/devEnvironment";
import { warnDevOnce } from "@/utils/helpers";

const EXACT_INITIAL_LAYOUT_EPSILON = 1;

type ExactInitialLayoutOptions<ItemT> = {
    alignItemsAtEnd: boolean;
    anchoredEndSpace: unknown;
    columnWrapperStyle: ColumnWrapperStyle | undefined;
    contentInset: Insets | undefined;
    contentInsetAdjustmentBehavior: string | undefined;
    contentInsetEndAdjustment: number | undefined;
    data: readonly ItemT[];
    exactInitialLayout: { height: number; width: number } | undefined;
    getFixedItemSize: LegendListPropsBase<ItemT>["getFixedItemSize"];
    getItemType: LegendListPropsBase<ItemT>["getItemType"];
    hasActiveRefreshControl: boolean;
    hasItemSeparator: boolean;
    hasListFooter: boolean;
    hasListHeader: boolean;
    horizontal: boolean;
    initialScroll: ScrollIndexWithOffsetAndContentOffset | undefined;
    isNewArchitecture: boolean;
    isRTL: boolean;
    numColumns: number;
    overrideItemLayout: LegendListPropsBase<ItemT>["overrideItemLayout"];
    renderScrollComponent: LegendListPropsBase<ItemT>["renderScrollComponent"];
    scrollAxisPaddingEnd: number;
    scrollAxisPaddingStart: number;
    snapToIndices: readonly number[] | undefined;
    stickyHeaderIndices: readonly number[] | undefined;
    useWindowScroll: boolean;
};

type ExactInitialLayoutResolution =
    | {
          reason: string;
          snapshot?: undefined;
      }
    | {
          reason?: undefined;
          snapshot: ExactInitialLayoutSnapshot;
      };

function isPositiveFinite(value: number | undefined): value is number {
    return value !== undefined && Number.isFinite(value) && value > 0;
}

function hasContentInset(contentInset: Insets | undefined) {
    return !!(contentInset?.top || contentInset?.right || contentInset?.bottom || contentInset?.left);
}

function getScrollAxisGap<ItemT>(options: ExactInitialLayoutOptions<ItemT>) {
    const { columnWrapperStyle, horizontal } = options;
    const gap = horizontal
        ? (columnWrapperStyle?.columnGap ?? columnWrapperStyle?.gap)
        : (columnWrapperStyle?.rowGap ?? columnWrapperStyle?.gap);
    return typeof gap === "number" && Number.isFinite(gap) ? gap : 0;
}

function hasUnsupportedLayoutModifier<ItemT>(options: ExactInitialLayoutOptions<ItemT>) {
    return (
        options.alignItemsAtEnd ||
        !!options.anchoredEndSpace ||
        options.hasActiveRefreshControl ||
        options.hasItemSeparator ||
        options.hasListFooter ||
        options.hasListHeader ||
        !!options.overrideItemLayout ||
        !!options.renderScrollComponent ||
        !!options.snapToIndices?.length ||
        !!options.stickyHeaderIndices?.length ||
        options.useWindowScroll ||
        getScrollAxisGap(options) !== 0 ||
        options.scrollAxisPaddingStart !== 0 ||
        options.scrollAxisPaddingEnd !== 0 ||
        hasContentInset(options.contentInset) ||
        (options.contentInsetAdjustmentBehavior !== undefined && options.contentInsetAdjustmentBehavior !== "never") ||
        !!options.contentInsetEndAdjustment
    );
}

function createExactInitialLayoutSnapshot<ItemT>(
    options: ExactInitialLayoutOptions<ItemT>,
    layout: { height: number; width: number },
    targetIndex: number,
): ExactInitialLayoutResolution {
    const { data, getFixedItemSize, getItemType, horizontal, initialScroll } = options;
    const viewportLength = horizontal ? layout.width : layout.height;
    const dataLength = data.length;
    const positions = new Array<number>(dataLength);
    const sizes = new Array<number>(dataLength);
    let totalSize = 0;
    let targetPosition = 0;
    let targetSize = 0;

    for (let index = 0; index < dataLength; index++) {
        const item = data[index];
        const itemType = getItemType ? (getItemType(item, index) ?? "") : "";
        const size = getFixedItemSize!(item, index, itemType);
        if (!isPositiveFinite(size)) {
            return {
                reason: "experimental_exactInitialLayout requires a positive finite getFixedItemSize result for every initial item.",
            };
        }

        positions[index] = totalSize;
        sizes[index] = size;
        if (index === targetIndex) {
            targetPosition = totalSize;
            targetSize = size;
        }
        totalSize += size;
    }

    let targetOffset = targetPosition;
    const viewOffset = initialScroll?.viewOffset;
    const viewPosition = initialScroll?.viewPosition;
    if (viewOffset) {
        targetOffset -= viewOffset;
    }
    if (viewPosition !== undefined) {
        targetOffset -= viewPosition * (viewportLength - targetSize);
    }

    const extraEndOffset = typeof viewOffset === "number" && viewOffset < 0 ? -viewOffset : 0;
    const maxOffset = Math.max(0, totalSize - viewportLength) + extraEndOffset;
    targetOffset = Math.max(0, Math.min(targetOffset, maxOffset));

    return {
        snapshot: {
            averageItemSize: totalSize / dataLength,
            height: layout.height,
            positions,
            sizes,
            targetIndex,
            targetOffset,
            totalSize,
            viewportLength,
            width: layout.width,
        },
    };
}

export function resolveExactInitialLayout<ItemT>(
    options: ExactInitialLayoutOptions<ItemT>,
): ExactInitialLayoutResolution | undefined {
    const { exactInitialLayout } = options;
    if (!exactInitialLayout) {
        return undefined;
    }
    if (!options.isNewArchitecture) {
        return { reason: "experimental_exactInitialLayout requires the new architecture (Fabric)." };
    }
    if (!isPositiveFinite(exactInitialLayout.width) || !isPositiveFinite(exactInitialLayout.height)) {
        return { reason: "experimental_exactInitialLayout requires positive finite width and height." };
    }
    if (options.data.length === 0) {
        return { reason: "experimental_exactInitialLayout requires non-empty initial data." };
    }
    if (options.numColumns !== 1) {
        return { reason: "experimental_exactInitialLayout currently supports single-column lists only." };
    }
    if (options.horizontal && options.isRTL) {
        return { reason: "experimental_exactInitialLayout does not yet support horizontal RTL lists." };
    }
    if (hasUnsupportedLayoutModifier(options)) {
        return {
            reason: "experimental_exactInitialLayout does not support layout modifiers whose initial contribution is measured after mount.",
        };
    }
    if (!options.getFixedItemSize) {
        return { reason: "experimental_exactInitialLayout requires getFixedItemSize." };
    }

    const initialScroll = options.initialScroll;
    const targetIndex = initialScroll?.contentOffset === undefined ? initialScroll?.index : undefined;
    if (
        targetIndex === undefined ||
        !Number.isInteger(targetIndex) ||
        targetIndex < 0 ||
        targetIndex >= options.data.length
    ) {
        return { reason: "experimental_exactInitialLayout requires an in-range integer initialScrollIndex." };
    }

    return createExactInitialLayoutSnapshot(options, exactInitialLayout, targetIndex);
}

export function useExactInitialLayoutFirstCommit<ItemT>(getOptions: () => ExactInitialLayoutOptions<ItemT>) {
    const ctx = useStateContext();
    if (ctx.exactInitialLayout === undefined) {
        const resolution = resolveExactInitialLayout(getOptions());
        ctx.exactInitialLayout = resolution?.snapshot ?? null;
        if (IS_DEV && resolution?.reason) {
            warnDevOnce(
                `exact-initial-layout-${resolution.reason}`,
                `${resolution.reason} Falling back to the normal initial-scroll path.`,
            );
        }
    }
    return !!ctx.exactInitialLayout;
}

export function attachExactInitialLayout(ctx: StateContext) {
    const snapshot = ctx.exactInitialLayout;
    if (snapshot) {
        ctx.state.exactInitialLayout = { snapshot };
        ctx.values.set("initialContentVisible", true);
    }
}

export function getActiveExactInitialLayout(ctx: StateContext) {
    const exactInitialLayout = ctx.state?.exactInitialLayout;
    return exactInitialLayout && !exactInitialLayout.invalidated ? exactInitialLayout : undefined;
}

export function isExactInitialLayoutActive(ctx: StateContext) {
    return !!getActiveExactInitialLayout(ctx);
}

export function seedExactInitialLayoutState(ctx: StateContext) {
    const exactInitialLayout = getActiveExactInitialLayout(ctx);
    if (!exactInitialLayout) {
        return;
    }

    const state = ctx.state;
    const { positions, sizes, targetOffset, totalSize, viewportLength } = exactInitialLayout.snapshot;
    const { data, keyExtractor } = state.props;
    state.scrollLength = viewportLength;

    for (let index = 0; index < data.length; index++) {
        const id = keyExtractor ? keyExtractor(data[index], index) : index;
        state.idCache[index] = id as string;
        state.indexByKey.set(id as string, index);
        state.sizes.set(id as string, sizes[index]);
        state.sizesKnown.set(id as string, sizes[index]);
        state.positions[index] = positions[index];
    }

    state.totalSize = totalSize;
    set$(ctx, "totalSize", totalSize);
    state.scroll = targetOffset;
    state.scrollPending = targetOffset;
    state.scrollPrev = targetOffset;
}

export function getExactInitialContentOffset(ctx: StateContext) {
    return getActiveExactInitialLayout(ctx)?.snapshot.targetOffset;
}

export function getExactInitialAverageItemSize(ctx: StateContext) {
    return getActiveExactInitialLayout(ctx)!.snapshot.averageItemSize;
}

export function recordExactInitialLayoutNativeOffset(ctx: StateContext, offset: number) {
    const exactInitialLayout = getActiveExactInitialLayout(ctx);
    if (exactInitialLayout && Number.isFinite(offset)) {
        exactInitialLayout.observedNativeOffset = offset;
    }
}

export function invalidateExactInitialLayout(ctx: StateContext) {
    const exactInitialLayout = ctx.state?.exactInitialLayout;
    if (!exactInitialLayout) {
        return;
    }

    exactInitialLayout.invalidated = true;
    exactInitialLayout.verified = false;
    exactInitialLayout.observedNativeOffset = undefined;
    hideExactInitialContent(ctx);
}

function hideExactInitialContent(ctx: StateContext) {
    if (peek$(ctx, "initialContentVisible")) {
        set$(ctx, "initialContentVisible", false);
    }
}

export function verifyExactInitialLayoutOnMeasure(ctx: StateContext, layout: LayoutRectangle) {
    const exactInitialLayout = getActiveExactInitialLayout(ctx);
    if (!exactInitialLayout || layout.width <= 0 || layout.height <= 0) {
        return;
    }

    const { height, width } = exactInitialLayout.snapshot;
    const matchesDeclaredLayout =
        Math.abs(layout.width - width) <= EXACT_INITIAL_LAYOUT_EPSILON &&
        Math.abs(layout.height - height) <= EXACT_INITIAL_LAYOUT_EPSILON;
    if (matchesDeclaredLayout) {
        exactInitialLayout.verified = true;
        return;
    }

    invalidateExactInitialLayout(ctx);
    if (IS_DEV) {
        warnDevOnce(
            "exact-initial-layout-mismatch",
            `experimental_exactInitialLayout declared ${width}x${height}, but the first measured layout was ${layout.width}x${layout.height}. Falling back to the normal initial-scroll path.`,
        );
    }
}

export function shouldFinishExactInitialScrollWithoutScroll(
    ctx: StateContext,
    resolvedOffset: number,
    options: {
        areMountedBufferedIndicesMeasured: boolean;
        areVisibleIndicesMeasured: boolean;
    },
) {
    const exactInitialLayout = getActiveExactInitialLayout(ctx);
    if (!exactInitialLayout?.verified) {
        return false;
    }
    if (!options.areMountedBufferedIndicesMeasured || !options.areVisibleIndicesMeasured) {
        return false;
    }

    const observedNativeOffset = exactInitialLayout.observedNativeOffset;
    if (observedNativeOffset === undefined || !Number.isFinite(observedNativeOffset)) {
        return false;
    }

    const didExactSeedSettle =
        Math.abs(exactInitialLayout.snapshot.targetOffset - resolvedOffset) <= EXACT_INITIAL_LAYOUT_EPSILON &&
        Math.abs(observedNativeOffset - resolvedOffset) <= EXACT_INITIAL_LAYOUT_EPSILON;
    if (!didExactSeedSettle) {
        const seededOffset = exactInitialLayout.snapshot.targetOffset;
        invalidateExactInitialLayout(ctx);
        if (IS_DEV) {
            warnDevOnce(
                "exact-initial-layout-offset-mismatch",
                `experimental_exactInitialLayout seeded offset ${seededOffset}, but the list settled at ${resolvedOffset} with a native offset of ${observedNativeOffset}. Falling back to the normal initial-scroll path.`,
            );
        }
        return false;
    }

    return Platform.OS !== "android";
}
