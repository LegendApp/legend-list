export type ComparisonLibraryId = "flatlist" | "flashlist" | "legendlist";

export type ComparisonExampleId = "cards" | "movies";

export type ComparisonLibraryMeta = {
    id: ComparisonLibraryId;
    label: string;
};

export type ComparisonExample = {
    description: string;
    id: ComparisonExampleId;
    title: string;
};

export const COMPARISON_ROUTE_SLUG = "comparisons";

export const COMPARISON_LIBRARIES: ComparisonLibraryMeta[] = [
    { id: "flatlist", label: "FlatList" },
    { id: "flashlist", label: "FlashList" },
    { id: "legendlist", label: "LegendList" },
];

export const COMPARISON_EXAMPLES: ComparisonExample[] = [
    {
        description: "Interactive variable-height cards with expandable content.",
        id: "cards",
        title: "Cards",
    },
    {
        description: "Nested horizontal movie rails with poster artwork.",
        id: "movies",
        title: "Movies",
    },
];

export function buildComparisonHref(exampleId: ComparisonExampleId, libraryId: ComparisonLibraryId) {
    return `/${COMPARISON_ROUTE_SLUG}?example=${exampleId}&list=${libraryId}`;
}

export const COMPARISON_HOME_ENTRIES = COMPARISON_EXAMPLES.map((example) => ({
    actions: COMPARISON_LIBRARIES.map((library) => ({
        href: buildComparisonHref(example.id, library.id),
        label: library.label,
    })),
    description: example.description,
    id: example.id,
    title: example.title,
}));

function getSingleSearchParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

export function getComparisonLibrary(value: string | string[] | undefined) {
    const libraryId = getSingleSearchParam(value);
    return COMPARISON_LIBRARIES.find((library) => library.id === libraryId) ?? COMPARISON_LIBRARIES[2];
}

export function getComparisonExample(value: string | string[] | undefined) {
    const exampleId = getSingleSearchParam(value);
    return COMPARISON_EXAMPLES.find((example) => example.id === exampleId) ?? COMPARISON_EXAMPLES[0];
}
