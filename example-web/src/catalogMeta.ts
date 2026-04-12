import { CURATED_EXAMPLES, CURATED_GROUP_ORDER } from "@examples/catalog";
import type { CatalogSection } from "./catalog/types";

function groupExamples() {
    return CURATED_GROUP_ORDER.map((group) => ({
        entries: CURATED_EXAMPLES.filter((entry) => entry.group === group).map(({ slug, tags, title }) => ({
            slug,
            tags,
            title,
        })),
        title: group,
    })) satisfies CatalogSection[];
}

export const EXAMPLE_SECTIONS = groupExamples();

export const FIXTURE_SECTIONS: CatalogSection[] = [
    {
        entries: [
            { slug: "accurate-scrollto", tags: ["Scroll"], title: "Accurate scrollTo" },
            { slug: "accurate-scrollto-huge", tags: ["Scroll"], title: "Accurate scrollTo Huge" },
            { slug: "add-to-end", tags: ["Append"], title: "Add to the End" },
            { slug: "always-render", tags: ["Rendering"], title: "Always Render" },
            { slug: "bidirectional-infinite-list", tags: ["Bidirectional"], title: "Bidirectional Infinite List" },
            { slug: "columns", tags: ["Grid"], title: "Columns" },
            { slug: "extra-data", tags: ["State"], title: "Extra Data" },
            { slug: "fixed-size-items", tags: ["Sizing"], title: "Fixed Size Items" },
            { slug: "initial-scroll-index", tags: ["Initial Scroll"], title: "Initial Scroll Index" },
            { slug: "lazy-list", tags: ["Lazy"], title: "Lazy List" },
            { slug: "mutable-cells", tags: ["State"], title: "Mutable Cells" },
            { slug: "mvcp-test", tags: ["MVCP"], title: "MVCP Test" },
            {
                slug: "prepend-large-items-jump",
                tags: ["Bidirectional", "MVCP"],
                title: "Prepend Large Items Jump",
            },
            { slug: "window-scroll", tags: ["Window Scroll"], title: "Window Scroll" },
        ],
        title: "List Behavior",
    },
    {
        entries: [
            { slug: "chat-example", tags: ["Chat"], title: "Chat Example" },
            { slug: "countries", tags: ["Directory"], title: "Countries" },
            {
                slug: "countries-with-headers-sticky",
                tags: ["Grouped", "Sticky Headers"],
                title: "Countries with Headers Sticky",
            },
        ],
        title: "Data & Grouping",
    },
    {
        entries: [{ slug: "virtual-list-comparison", tags: ["Comparison"], title: "Virtual List Comparison" }],
        title: "Comparison & Stress",
    },
];
