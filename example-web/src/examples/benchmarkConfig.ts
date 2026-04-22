export type BenchmarkLibraryId = "legend-list" | "virtua" | "react-virtuoso" | "react-window" | "tanstack-virtual";

export type BenchmarkLibrarySelection = BenchmarkLibraryId | "all";

export type BenchmarkScrollAlign = "center" | "end" | "start";

export type BenchmarkScenarioId = "bounds-tour" | "jump-tour" | "scan";

export type BenchmarkScenarioStep = {
    align?: BenchmarkScrollAlign;
    index: number;
    label: string;
    pauseMs: number;
};

export type BenchmarkLibraryMeta = {
    description: string;
    id: BenchmarkLibraryId;
    label: string;
};

type BenchmarkScenarioDefinition = {
    buildSteps: (itemCount: number) => BenchmarkScenarioStep[];
    description: string;
    id: BenchmarkScenarioId;
    label: string;
    settleMs: number;
};

export const BENCHMARK_LIBRARIES: readonly BenchmarkLibraryMeta[] = [
    {
        description: "Legend List running through the package's web entrypoint.",
        id: "legend-list",
        label: "LegendList",
    },
    {
        description: "virtua VList with lazy row rendering.",
        id: "virtua",
        label: "virtua",
    },
    {
        description: "react-virtuoso with variable-height itemContent.",
        id: "react-virtuoso",
        label: "react-virtuoso",
    },
    {
        description: "react-window List using dynamic row heights.",
        id: "react-window",
        label: "react-window",
    },
    {
        description: "TanStack Virtual backed by a custom scroll container.",
        id: "tanstack-virtual",
        label: "TanStack Virtual",
    },
] as const;

const BENCHMARK_SCENARIOS = [
    {
        buildSteps: (itemCount: number) =>
            createSteps(itemCount, [
                { align: "start", index: 0, label: "Top" },
                { align: "end", index: itemCount - 1, label: "Bottom" },
                { align: "center", index: Math.floor(itemCount * 0.5), label: "Center" },
                { align: "start", index: 0, label: "Reset" },
            ]),
        description: "Touches the top, bottom, and center anchors to expose reset and edge behavior.",
        id: "bounds-tour",
        label: "Bounds Tour",
        settleMs: 160,
    },
    {
        buildSteps: (itemCount: number) =>
            createSteps(itemCount, [
                { index: 0, label: "Top" },
                { index: Math.floor(itemCount * 0.14), label: "14%" },
                { index: Math.floor(itemCount * 0.36), label: "36%" },
                { index: Math.floor(itemCount * 0.62), label: "62%" },
                { index: Math.floor(itemCount * 0.86), label: "86%" },
                { align: "end", index: itemCount - 1, label: "Bottom" },
                { align: "center", index: Math.floor(itemCount * 0.5), label: "Center" },
                { index: 0, label: "Reset" },
            ]),
        description: "Programmatic large jumps through the dataset with a final reset to the top.",
        id: "jump-tour",
        label: "Jump Tour",
        settleMs: 180,
    },
    {
        buildSteps: (itemCount: number) => {
            const increments = Array.from({ length: 6 }, (_, stepIndex) =>
                Math.floor(((stepIndex + 1) / 6) * Math.max(itemCount - 1, 0)),
            );
            return createSteps(itemCount, [
                { index: 0, label: "Top" },
                ...increments.map((index, stepIndex) => ({
                    index,
                    label: `Sweep ${stepIndex + 1}`,
                })),
                { align: "end", index: itemCount - 1, label: "Bottom" },
                { index: 0, label: "Reset" },
            ]);
        },
        description: "A longer sweep that walks forward through evenly spaced checkpoints.",
        id: "scan",
        label: "Long Scan",
        settleMs: 200,
    },
] satisfies readonly BenchmarkScenarioDefinition[];

function clampBenchmarkIndex(index: number, itemCount: number) {
    if (itemCount <= 0) {
        return 0;
    }
    return Math.max(0, Math.min(index, itemCount - 1));
}

function createSteps(
    itemCount: number,
    steps: Array<Omit<BenchmarkScenarioStep, "index" | "pauseMs"> & { index: number; pauseMs?: number }>,
) {
    const normalizedSteps: BenchmarkScenarioStep[] = [];

    for (const step of steps) {
        const normalizedIndex = clampBenchmarkIndex(step.index, itemCount);
        const previousStep = normalizedSteps[normalizedSteps.length - 1];
        if (
            previousStep &&
            previousStep.align === step.align &&
            previousStep.index === normalizedIndex &&
            previousStep.label === step.label
        ) {
            continue;
        }

        normalizedSteps.push({
            align: step.align,
            index: normalizedIndex,
            label: step.label,
            pauseMs: step.pauseMs ?? 140,
        });
    }

    return normalizedSteps;
}

export function getBenchmarkLibraryMeta(libraryId: BenchmarkLibraryId) {
    return BENCHMARK_LIBRARIES.find((library) => library.id === libraryId)!;
}

export function getVisibleBenchmarkLibraryIds(selection: BenchmarkLibrarySelection): BenchmarkLibraryId[] {
    return selection === "all" ? BENCHMARK_LIBRARIES.map((library) => library.id) : [selection];
}

export function getBenchmarkScenarioDefinition(scenarioId: BenchmarkScenarioId) {
    return BENCHMARK_SCENARIOS.find((scenario) => scenario.id === scenarioId)!;
}

export function buildBenchmarkScenarioSteps(scenarioId: BenchmarkScenarioId, itemCount: number) {
    return getBenchmarkScenarioDefinition(scenarioId).buildSteps(itemCount);
}

export function getBenchmarkScenarioBudgetMs(scenarioId: BenchmarkScenarioId, itemCount: number) {
    const scenario = getBenchmarkScenarioDefinition(scenarioId);
    const stepBudgetMs = buildBenchmarkScenarioSteps(scenarioId, itemCount).reduce(
        (total, step) => total + step.pauseMs,
        0,
    );
    return stepBudgetMs + scenario.settleMs;
}

export function getBenchmarkScenarioOptions() {
    return BENCHMARK_SCENARIOS.map(({ description, id, label }) => ({
        description,
        id,
        label,
    }));
}
