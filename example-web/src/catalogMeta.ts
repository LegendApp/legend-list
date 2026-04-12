import { CURATED_EXAMPLES, CURATED_GROUP_ORDER } from "@examples/catalog";
import type { CatalogSection } from "./catalog/types";

function groupExamples() {
    return CURATED_GROUP_ORDER.map((group) => ({
        entries: CURATED_EXAMPLES.filter((entry) => entry.group === group).map(({ description, slug, title }) => ({
            description,
            slug,
            title,
        })),
        title: group,
    })) satisfies CatalogSection[];
}

export const EXAMPLE_SECTIONS = groupExamples();

export const FIXTURE_SECTIONS: CatalogSection[] = [
    {
        entries: [
            {
                description: "Verifies indexed scrollTo accuracy on variable-height content.",
                slug: "accurate-scrollto",
                title: "Accurate scrollTo",
            },
            {
                description: "Stress-tests scrollTo accuracy deep into a very large dataset.",
                slug: "accurate-scrollto-huge",
                title: "Accurate scrollTo Huge",
            },
            {
                description: "Appends new rows while keeping the viewport stable at the end.",
                slug: "add-to-end",
                title: "Add to the End",
            },
            {
                description: "Keeps nearby cells mounted to inspect render-window behavior.",
                slug: "always-render",
                title: "Always Render",
            },
            {
                description: "Exercises prepend and append pagination in the same list.",
                slug: "bidirectional-infinite-list",
                title: "Bidirectional Infinite List",
            },
            {
                description: "Checks multi-column measurement and placement behavior.",
                slug: "columns",
                title: "Columns",
            },
            {
                description: "Forces external state updates through visible cells.",
                slug: "extra-data",
                title: "Extra Data",
            },
            {
                description: "Validates sizing when every row uses the same height.",
                slug: "fixed-size-items",
                title: "Fixed Size Items",
            },
            {
                description: "Starts the list at a target index and checks landing accuracy.",
                slug: "initial-scroll-index",
                title: "Initial Scroll Index",
            },
            {
                description: "Defers rendering until rows are needed near the viewport.",
                slug: "lazy-list",
                title: "Lazy List",
            },
            {
                description: "Updates cell state in place to confirm recycle safety.",
                slug: "mutable-cells",
                title: "Mutable Cells",
            },
            {
                description: "Regression surface for maintain-visible-content-position behavior.",
                slug: "mvcp-test",
                title: "MVCP Test",
            },
            {
                description: "Reproduces prepend jumps with large inserted items.",
                slug: "prepend-large-items-jump",
                title: "Prepend Large Items Jump",
            },
            {
                description: "Runs LegendList against the browser window scroller.",
                slug: "window-scroll",
                title: "Window Scroll",
            },
        ],
        title: "List Behavior",
    },
    {
        entries: [
            {
                description: "Chat-style timeline with anchored auto-scroll behavior.",
                slug: "chat-example",
                title: "Chat Example",
            },
            { description: "Searchable directory with dynamic filtering.", slug: "countries", title: "Countries" },
            {
                description: "Grouped directory with sticky section headers.",
                slug: "countries-with-headers-sticky",
                title: "Countries with Headers Sticky",
            },
        ],
        title: "Data & Grouping",
    },
    {
        entries: [
            {
                description: "Compares LegendList behavior against a simple virtual list baseline.",
                slug: "virtual-list-comparison",
                title: "Virtual List Comparison",
            },
        ],
        title: "Comparison & Stress",
    },
];
