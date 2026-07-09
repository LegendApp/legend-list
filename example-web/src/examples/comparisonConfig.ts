export type ComparisonLibraryId = "legend-list" | "virtua" | "react-virtuoso" | "react-window" | "tanstack-virtual";

export type ComparisonLibrarySelection = ComparisonLibraryId | "all";

export type ComparisonLibraryRuntimeConfig = {
    drawDistance?: number;
    increaseViewportBy?: {
        bottom: number;
        top: number;
    };
    overscan?: number;
    overscanCount?: number;
};

export type ComparisonLibraryMeta = {
    description: string;
    id: ComparisonLibraryId;
    label: string;
    runtime: ComparisonLibraryRuntimeConfig;
};

export type ComparisonSearchState = {
    count: number;
    extraNodes: number;
    librarySelection: ComparisonLibrarySelection;
    workMs: number;
};

const DefaultCount = 5000;
const DefaultExtraNodes = 12;
const DefaultWorkMs = 2;
const DefaultLibrarySelection: ComparisonLibrarySelection = "all";

export const COMPARISON_VIEWPORT_HEIGHT = 640;
export const COMPARISON_ESTIMATED_ROW_HEIGHT = 140;
export const COMPARISON_PRELOAD_PX = 500;
export const COMPARISON_OVERSCAN_COUNT = Math.max(
    1,
    Math.ceil(COMPARISON_PRELOAD_PX / COMPARISON_ESTIMATED_ROW_HEIGHT),
);

export const DEFAULT_COMPARISON_STATE: ComparisonSearchState = {
    count: DefaultCount,
    extraNodes: DefaultExtraNodes,
    librarySelection: DefaultLibrarySelection,
    workMs: DefaultWorkMs,
};

export const COMPARISON_LIBRARIES: readonly ComparisonLibraryMeta[] = [
    {
        description: "Legend List running through the package's web entrypoint.",
        id: "legend-list",
        label: "LegendList",
        runtime: {
            drawDistance: COMPARISON_PRELOAD_PX,
        },
    },
    {
        description: "virtua VList with lazy row rendering.",
        id: "virtua",
        label: "virtua",
        runtime: {
            overscan: COMPARISON_OVERSCAN_COUNT,
        },
    },
    {
        description: "react-virtuoso with variable-height itemContent.",
        id: "react-virtuoso",
        label: "react-virtuoso",
        runtime: {
            increaseViewportBy: {
                bottom: COMPARISON_PRELOAD_PX,
                top: COMPARISON_PRELOAD_PX,
            },
        },
    },
    {
        description: "react-window List using dynamic row heights.",
        id: "react-window",
        label: "react-window",
        runtime: {
            overscanCount: COMPARISON_OVERSCAN_COUNT,
        },
    },
    {
        description: "TanStack Virtual backed by a custom scroll container.",
        id: "tanstack-virtual",
        label: "TanStack Virtual",
        runtime: {
            overscan: COMPARISON_OVERSCAN_COUNT,
        },
    },
] as const;

function clampNumber(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function parseNumberSearchParam(value: string | null, fallback: number, min: number, max: number) {
    if (value === null || value === "") {
        return fallback;
    }

    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) {
        return fallback;
    }
    return clampNumber(parsedValue, min, max);
}

function isComparisonLibraryId(value: string | null): value is ComparisonLibraryId {
    return COMPARISON_LIBRARIES.some((library) => library.id === value);
}

export function getComparisonLibraryMeta(libraryId: ComparisonLibraryId) {
    return COMPARISON_LIBRARIES.find((library) => library.id === libraryId)!;
}

export function getComparisonLibraryRuntimeConfig(libraryId: ComparisonLibraryId) {
    return getComparisonLibraryMeta(libraryId).runtime;
}

export function getVisibleComparisonLibraryIds(selection: ComparisonLibrarySelection): ComparisonLibraryId[] {
    return selection === "all" ? COMPARISON_LIBRARIES.map((library) => library.id) : [selection];
}

export function parseComparisonSearch(search: string): ComparisonSearchState {
    const params = new URLSearchParams(search);
    const parsedLibrary = params.get("library");
    const librarySelection =
        parsedLibrary === "all" || isComparisonLibraryId(parsedLibrary) ? parsedLibrary : DefaultLibrarySelection;

    return {
        count: parseNumberSearchParam(params.get("count"), DefaultCount, 5000, 100000),
        extraNodes: parseNumberSearchParam(params.get("extraNodes"), DefaultExtraNodes, 0, 60),
        librarySelection,
        workMs: parseNumberSearchParam(params.get("workMs"), DefaultWorkMs, 0, 12),
    };
}

export function buildComparisonSearch(searchState: ComparisonSearchState) {
    const params = new URLSearchParams();

    if (searchState.librarySelection !== DefaultLibrarySelection) {
        params.set("library", searchState.librarySelection);
    }

    if (searchState.count !== DefaultCount) {
        params.set("count", String(searchState.count));
    }

    if (searchState.workMs !== DefaultWorkMs) {
        params.set("workMs", String(searchState.workMs));
    }

    if (searchState.extraNodes !== DefaultExtraNodes) {
        params.set("extraNodes", String(searchState.extraNodes));
    }

    const search = params.toString();
    return search ? `?${search}` : "";
}
