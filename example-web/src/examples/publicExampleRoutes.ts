export type PublicExampleGroup = "Benchmarks";

export type PublicExampleSlug = "library-benchmark";

export type PublicExampleRoute = {
    description: string;
    group: PublicExampleGroup;
    slug: PublicExampleSlug;
    title: string;
};

export const PUBLIC_EXAMPLE_GROUP_ORDER = ["Benchmarks"] as const;

export const PUBLIC_EXAMPLE_ROUTES: readonly PublicExampleRoute[] = [
    {
        description: "Scriptable cross-library benchmark with manual tuning and repeatable jump scenarios.",
        group: "Benchmarks",
        slug: "library-benchmark",
        title: "Library Benchmark",
    },
] as const;
