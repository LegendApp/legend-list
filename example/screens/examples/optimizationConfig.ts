export type OptimizationDemoId = "data" | "identities" | "invalidation" | "recycling";

export type OptimizationDemo = {
    description: string;
    id: OptimizationDemoId;
    label: string;
    title: string;
};

export const OPTIMIZATION_ROUTE_SLUG = "optimization";

export const OPTIMIZATION_DEMOS: OptimizationDemo[] = [
    {
        description: "Compare broad extraData invalidation with item-scoped external state.",
        id: "invalidation",
        label: "State",
        title: "External State vs. extraData",
    },
    {
        description: "See which list prop identities change when an unrelated parent renders.",
        id: "identities",
        label: "Identities",
        title: "Stable Identities",
    },
    {
        description: "See local state follow a recycled container, then reset it for each item.",
        id: "recycling",
        label: "Recycling",
        title: "Recycling State",
    },
    {
        description: "Explore itemsAreEqual and dataKey with equivalent items and new datasets.",
        id: "data",
        label: "Data",
        title: "Dataset Identity",
    },
];

export function buildOptimizationHref(demoId: OptimizationDemoId) {
    return `/${OPTIMIZATION_ROUTE_SLUG}?demo=${demoId}`;
}

export const OPTIMIZATION_HOME_ENTRIES = OPTIMIZATION_DEMOS.map((demo) => ({
    description: demo.description,
    href: buildOptimizationHref(demo.id),
    id: `optimization-${demo.id}`,
    title: demo.title,
}));

function getSingleSearchParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

export function getOptimizationDemo(value: string | string[] | undefined) {
    const demoId = getSingleSearchParam(value);
    return OPTIMIZATION_DEMOS.find((demo) => demo.id === demoId) ?? OPTIMIZATION_DEMOS[0];
}
