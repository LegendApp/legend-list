import type { InternalState, MaintainScrollAtEndOptions } from "../../src/types";
import { normalizeMaintainScrollAtEnd } from "../../src/utils/normalizeMaintainScrollAtEnd";
import { normalizeMaintainVisibleContentPosition } from "../../src/utils/normalizeMaintainVisibleContentPosition";

export const DEFAULT_CONTENT_INSET = { bottom: 0, left: 0, right: 0, top: 0 };

type LayoutArray = Array<number | undefined>;
type MockStatePropsOverrides = Partial<Omit<InternalState["props"], "maintainScrollAtEnd">> & {
    maintainScrollAtEnd?: boolean | MaintainScrollAtEndOptions;
};
type MockStateOverrides = Partial<Omit<InternalState, "props" | "totalSizeExact">> & {
    props?: MockStatePropsOverrides;
    totalSize?: number;
    totalSizeExact?: number;
};

function toLayoutArray(source: unknown): LayoutArray {
    return Array.isArray(source) ? (source.slice() as LayoutArray) : [];
}

export function createMockState(
    overrides: MockStateOverrides = {},
): InternalState {
    const { props: propsOverrides, totalSize, totalSizeExact = totalSize ?? 1000, ...stateOverrides } = overrides;
    const state = {
        // Required by UpdateItemPositions
        averageSizes: {},
        columnSpans: [],
        // Core calculateItemsInView properties
        columns: [],
        containerItemKeys: new Map(),
        containerItemTypes: new Map(),
        contentInsetOverride: undefined,
        dataChangeEpoch: 0,
        dataChangeNeedsScrollUpdate: false,
        deferredPositions: undefined,
        enableScrollForNextCalculateItemsInView: true,
        // Required by Pick types from dependencies
        endBuffered: 0,
        endNoBuffer: 0,
        endReachedSnapshot: undefined,
        firstFullyOnScreenIndex: 0,
        idCache: [],
        idsInView: [],
        ignoreScrollFromMVCP: undefined,
        ignoreScrollFromMVCPIgnored: false,
        ignoreScrollFromMVCPTimeout: undefined,
        indexByKey: new Map(),
        initialAnchor: undefined,
        initialNativeScrollWatchdog: undefined,
        initialScroll: undefined,
        initialScrollLastDidFinish: false,
        initialScrollLastTarget: undefined,
        initialScrollLastTargetUsesOffset: false,
        initialScrollPreviousDataLength: 0,
        initialScrollRetryLastLength: undefined,
        initialScrollRetryWindowUntil: 0,
        initialScrollUsesOffset: false,
        isAtEnd: false,
        isAtStart: false,
        isEndReached: null,
        isStartReached: null,
        lastBatchingAction: 0,
        lastLayout: undefined,
        // Required by CheckAtBottom and SetDidLayout
        loadStartTime: Date.now(),
        maintainingScrollAtEnd: false,
        minIndexSizeChanged: undefined,
        nativeContentInset: undefined,
        nativeMarginTop: 0,
        needsOtherAxisSize: false,
        otherAxisSize: undefined,
        pendingMaintainScrollAtEnd: false,
        pendingNativeMVCPAdjust: undefined,
        prependMeasurementWindow: undefined,
        positions: [],
        queuedCalculateItemsInView: undefined,
        queuedInitialLayout: false,
        refScroller: { current: null } as InternalState["refScroller"],
        scroll: 0,
        scrollAdjustHandler: {
            getAdjust: () => 0,
            requestAdjust: () => {}, // Mock scroll adjust handler
            setMounted: () => {},
        },
        scrollForNextCalculateItemsInView: undefined,
        scrollHistory: [],
        // Required by PrepareMVCP
        scrollLength: 300,
        scrollPending: 0,
        scrollPrev: 0,
        scrollPrevTime: 0,
        scrollTime: 0,
        userScrollActive: false,
        sizes: new Map(),
        sizesKnown: new Map(),
        startBuffered: 0,
        startBufferedId: undefined,
        startNoBuffer: 0,
        startReachedSnapshot: undefined,
        startReachedSnapshotDataChangeEpoch: undefined,
        // Sticky container setup (empty by default)
        stickyContainerPool: new Set(),
        stickyContainers: new Map(),
        timeoutSetPaddingTop: undefined,
        timeoutSizeMessage: undefined,
        timeoutUserScrollActive: undefined,
        timeouts: new Set(),
        totalSizeExact,
        triggerCalculateItemsInView: () => {},
        viewabilityConfigCallbackPairs: undefined,
        ...stateOverrides,
        props: {
            alignItemsAtEnd: false,
            alwaysRender: undefined,
            alwaysRenderIndicesArr: [],
            alwaysRenderIndicesSet: new Set<number>(),
            contentInset: DEFAULT_CONTENT_INSET,
            data: [],
            dataVersion: undefined,
            drawDistance: 100,
            estimatedItemSize: undefined,
            getEstimatedItemSize: undefined,
            getFixedItemSize: undefined,
            getItemType: undefined,
            horizontal: false,
            initialContainerPoolRatio: 2,
            initialScroll: undefined,
            itemsAreEqual: undefined,
            keyExtractor: (_: any, index: number) => `item_${index}`,
            maintainScrollAtEnd: undefined,
            maintainScrollAtEndThreshold: 0.1,
            maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(undefined),
            numColumns: 1,
            onEndReached: undefined,
            onEndReachedThreshold: 0.1,
            onItemSizeChanged: undefined,
            onLoad: undefined,
            onScroll: undefined,
            onStartReached: undefined,
            onStartReachedThreshold: 0.1,
            overrideItemLayout: undefined,
            recycleItems: false,
            renderItem: undefined,
            snapToIndices: undefined,
            stickyIndicesArr: [],
            // Provide empty sticky indices for tests by default
            stickyIndicesSet: new Set<number>(),
            stylePaddingBottom: undefined,
            stylePaddingTop: 0,
            suggestEstimatedItemSize: false,
            useWindowScroll: false,
            ...(propsOverrides ?? {}),
        },
    } as unknown as InternalState & Record<string, unknown>;
    const props = state.props as InternalState["props"] & { maintainScrollAtEnd?: unknown };
    let maintainScrollAtEnd = normalizeMaintainScrollAtEnd(
        props.maintainScrollAtEnd as boolean | MaintainScrollAtEndOptions | undefined,
    );

    Object.defineProperty(props, "maintainScrollAtEnd", {
        configurable: true,
        enumerable: true,
        get: () => maintainScrollAtEnd,
        set: (value) => {
            maintainScrollAtEnd = normalizeMaintainScrollAtEnd(
                value as boolean | MaintainScrollAtEndOptions | undefined,
            );
        },
    });

    let positions = toLayoutArray(state.positions);
    let columns = toLayoutArray(state.columns);
    let columnSpans = toLayoutArray(state.columnSpans);

    Object.defineProperty(state, "positions", {
        configurable: true,
        enumerable: true,
        get: () => positions,
        set: (value) => {
            if (value === positions) return;
            positions = toLayoutArray(value);
        },
    });
    Object.defineProperty(state, "columns", {
        configurable: true,
        enumerable: true,
        get: () => columns,
        set: (value) => {
            if (value === columns) return;
            columns = toLayoutArray(value);
        },
    });
    Object.defineProperty(state, "columnSpans", {
        configurable: true,
        enumerable: true,
        get: () => columnSpans,
        set: (value) => {
            if (value === columnSpans) return;
            columnSpans = toLayoutArray(value);
        },
    });

    return state as InternalState;
}
