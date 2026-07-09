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
        description: "Manual cross-library benchmark for side-by-side scrolling comparison.",
        group: "Benchmarks",
        slug: "library-benchmark",
        title: "Library Benchmark",
    },
] as const;
