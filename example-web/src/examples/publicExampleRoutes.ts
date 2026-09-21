export type PublicExampleGroup = "Advanced" | "Benchmarks";

export type PublicExampleSlug = "item-separators" | "library-benchmark";

export type PublicExampleRoute = {
    description: string;
    group: PublicExampleGroup;
    slug: PublicExampleSlug;
    title: string;
};

export const PUBLIC_EXAMPLE_GROUP_ORDER = ["Advanced", "Benchmarks"] as const;

export const PUBLIC_EXAMPLE_ROUTES: readonly PublicExampleRoute[] = [
    {
        description: "Color each separator from the leading and trailing items on either side of it.",
        group: "Advanced",
        slug: "item-separators",
        title: "Item Separators",
    },
    {
        description: "Manual cross-library benchmark for side-by-side scrolling comparison.",
        group: "Benchmarks",
        slug: "library-benchmark",
        title: "Library Benchmark",
    },
] as const;
