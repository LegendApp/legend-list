import { syncInitialScrollSessionFromLegacyState } from "../../src/core/initialScrollSession";
import type {
    BootstrapInitialScrollSession,
    InitialScrollSessionCompletion,
    InternalState,
    MaintainScrollAtEndOptions,
} from "../../src/types";
import { normalizeMaintainScrollAtEnd } from "../../src/utils/normalizeMaintainScrollAtEnd";
import { normalizeMaintainVisibleContentPosition } from "../../src/utils/normalizeMaintainVisibleContentPosition";

export const DEFAULT_CONTENT_INSET = { bottom: 0, left: 0, right: 0, top: 0 };

type LayoutArray = Array<number | undefined>;
type MockStatePropsOverrides = Partial<Omit<InternalState["props"], "maintainScrollAtEnd">> & {
    maintainScrollAtEnd?: boolean | MaintainScrollAtEndOptions;
};

type LegacyInitialScrollOverrides = {
    bootstrapInitialScroll?: BootstrapInitialScrollSession;
    didDispatchNativeScroll?: boolean;
    didRetrySilentInitialScroll?: boolean;
    initialNativeScrollWatchdog?: InitialScrollSessionCompletion["watchdog"];
    initialScrollPreviousDataLength?: number;
    initialScrollUsesOffset?: boolean;
};

export type MockState = InternalState & LegacyInitialScrollOverrides;

function toLayoutArray(source: unknown): LayoutArray {
    return Array.isArray(source) ? (source.slice() as LayoutArray) : [];
}

export function createMockState(
    overrides: Partial<
        Omit<InternalState, "props"> & { props: MockStatePropsOverrides } & LegacyInitialScrollOverrides
    > = {},
): MockState {
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
        initialScroll: undefined,
        initialScrollSession: undefined,
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
        timeouts: new Set(),
        totalSize: 1000,
        triggerCalculateItemsInView: () => {},
        viewabilityConfigCallbackPairs: undefined,
        ...overrides,
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
            ...(overrides.props ?? {}),
        },
    } as unknown as InternalState & Record<string, unknown>;

    const inferredInitialScrollKind =
        overrides.initialScrollSession?.kind ??
        (overrides.initialScrollUsesOffset
            ? "offset"
            : overrides.initialScroll || overrides.bootstrapInitialScroll
              ? "bootstrap"
              : undefined);

    if (overrides.initialScrollSession) {
        state.initialScrollSession = overrides.initialScrollSession;
    } else if (inferredInitialScrollKind) {
        syncInitialScrollSessionFromLegacyState(state as InternalState, {
            bootstrap: overrides.bootstrapInitialScroll,
            kind: inferredInitialScrollKind,
            previousDataLength: overrides.initialScrollPreviousDataLength ?? 0,
        });
    }

    if (
        overrides.didDispatchNativeScroll ||
        overrides.didRetrySilentInitialScroll ||
        overrides.initialNativeScrollWatchdog
    ) {
        state.initialScrollSession ??= {
            completion: {},
            kind: inferredInitialScrollKind ?? "bootstrap",
            phase: "waitingForLayout",
            previousDataLength: overrides.initialScrollPreviousDataLength ?? 0,
            target: state.initialScroll,
        };
        state.initialScrollSession.completion = {
            didDispatchNativeScroll: overrides.didDispatchNativeScroll,
            didRetrySilentInitialScroll: overrides.didRetrySilentInitialScroll,
            watchdog: overrides.initialNativeScrollWatchdog,
        };
    }

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

    Object.defineProperties(state, {
        bootstrapInitialScroll: {
            configurable: true,
            enumerable: false,
            get: () =>
                state.initialScrollSession?.kind === "bootstrap" ? state.initialScrollSession.bootstrap : undefined,
            set: (value: BootstrapInitialScrollSession | undefined) => {
                syncInitialScrollSessionFromLegacyState(state as InternalState, {
                    bootstrap: value,
                    kind: value ? "bootstrap" : state.initialScrollSession?.kind,
                });
            },
        },
        didDispatchNativeScroll: {
            configurable: true,
            enumerable: false,
            get: () => state.initialScrollSession?.completion?.didDispatchNativeScroll,
            set: (value: boolean | undefined) => {
                state.initialScrollSession ??= {
                    completion: {},
                    kind: "bootstrap",
                    phase: "waitingForLayout",
                    previousDataLength: 0,
                    target: state.initialScroll,
                };
                state.initialScrollSession.completion ??= {};
                state.initialScrollSession.completion.didDispatchNativeScroll = value;
            },
        },
        didRetrySilentInitialScroll: {
            configurable: true,
            enumerable: false,
            get: () => state.initialScrollSession?.completion?.didRetrySilentInitialScroll,
            set: (value: boolean | undefined) => {
                state.initialScrollSession ??= {
                    completion: {},
                    kind: "bootstrap",
                    phase: "waitingForLayout",
                    previousDataLength: 0,
                    target: state.initialScroll,
                };
                state.initialScrollSession.completion ??= {};
                state.initialScrollSession.completion.didRetrySilentInitialScroll = value;
            },
        },
        initialNativeScrollWatchdog: {
            configurable: true,
            enumerable: false,
            get: () => state.initialScrollSession?.completion?.watchdog,
            set: (value: InitialScrollSessionCompletion["watchdog"] | undefined) => {
                state.initialScrollSession ??= {
                    completion: {},
                    kind: "bootstrap",
                    phase: "waitingForLayout",
                    previousDataLength: 0,
                    target: state.initialScroll,
                };
                state.initialScrollSession.completion ??= {};
                state.initialScrollSession.completion.watchdog = value;
            },
        },
        initialScrollPreviousDataLength: {
            configurable: true,
            enumerable: false,
            get: () => state.initialScrollSession?.previousDataLength ?? 0,
            set: (value: number) => {
                state.initialScrollSession ??= {
                    kind: "bootstrap",
                    phase: "waitingForLayout",
                    previousDataLength: value,
                    target: state.initialScroll,
                };
                state.initialScrollSession.previousDataLength = value;
            },
        },
        initialScrollUsesOffset: {
            configurable: true,
            enumerable: false,
            get: () => state.initialScrollSession?.kind === "offset",
            set: (value: boolean) => {
                syncInitialScrollSessionFromLegacyState(state as InternalState, {
                    kind: value ? "offset" : "bootstrap",
                });
            },
        },
    });

    return state as MockState;
}
