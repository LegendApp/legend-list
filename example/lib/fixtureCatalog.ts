import type { CatalogGroup } from "./catalogTypes";

export const FIXTURE_CATALOG: CatalogGroup[] = [
    {
        entries: [
            {
                description: "Verifies indexed scrollTo accuracy on variable-height content.",
                href: "/accurate-scrollto",
                title: "Accurate ScrollTo",
            },
            {
                description: "Alternate scrollTo surface for validating index landing behavior.",
                href: "/accurate-scrollto-2",
                title: "Accurate ScrollTo 2",
            },
            {
                description: "Stress-tests scrollTo accuracy deep into a very large dataset.",
                href: "/accurate-scrollto-huge",
                title: "Accurate ScrollTo Huge",
            },
            {
                description: "Starts the list at a target index and checks landing accuracy.",
                href: "/initial-scroll-index",
                title: "Initial Scroll Index",
            },
            {
                description: "Tests initial scroll landing when rows measure to free height.",
                href: "/initial-scroll-index-free-height",
                title: "Initial Scroll Index Free Height",
            },
            {
                description: "Validates initial index landing when keys drive row identity.",
                href: "/initial-scroll-index-keyed",
                title: "Initial Scroll Index Keyed",
            },
            {
                description: "Starts from the end of the list and checks anchored positioning.",
                href: "/initial-scroll-start-at-the-end",
                title: "Initial Scroll Start At End",
            },
            {
                description: "Checks starting at the end before any rows have been appended.",
                href: "/initial-scroll-at-end-empty",
                title: "Initial Scroll End Empty",
            },
            {
                description: "Appends new rows while keeping the viewport stable at the end.",
                href: "/add-to-end",
                title: "Add To End",
            },
            {
                description: "Exercises prepend and append pagination in the same list.",
                href: "/bidirectional-infinite-list",
                title: "Bidirectional Infinite List",
            },
            {
                description: "Regression surface for maintain-visible-content-position behavior.",
                href: "/mvcp-test",
                title: "MVCP Test",
            },
            {
                description: "Keeps nearby cells mounted to inspect render-window behavior.",
                href: "/always-render",
                title: "Always Render",
            },
            {
                description: "Defers rendering until rows are needed near the viewport.",
                href: "/lazy-list",
                title: "Lazy List",
            },
        ],
        key: "scroll",
        title: "Scroll & Position",
    },
    {
        entries: [
            {
                description: "Chat-style timeline with anchored auto-scroll behavior.",
                href: "/chat-example",
                title: "Chat Example",
            },
            {
                description: "Loads older messages as you scroll through an infinite chat.",
                href: "/chat-infinite",
                title: "Chat Infinite",
            },
            {
                description: "Checks chat input and keyboard avoidance together.",
                href: "/chat-keyboard",
                title: "Chat Keyboard",
            },
            {
                description: "Exercises keyboard handling with a taller composer.",
                href: "/chat-keyboard-big",
                title: "Chat Keyboard Big",
            },
            {
                description: "Validates chat layout when an outer container resizes.",
                href: "/chat-resize-outer",
                title: "Chat Resize Outer",
            },
            { description: "Streams AI responses into a chat timeline.", href: "/ai-chat", title: "AI Chat" },
            {
                description: "Combines AI streaming with keyboard-safe chat input.",
                href: "/ai-chat-keyboard",
                title: "AI Keyboard Chat",
            },
        ],
        key: "chat",
        title: "Chat & Keyboard",
    },
    {
        entries: [
            { description: "Searchable directory with dynamic filtering.", href: "/countries", title: "Countries" },
            {
                description: "Grouped directory with section headers between regions.",
                href: "/countries-with-headers",
                title: "Countries With Headers",
            },
            {
                description: "Grouped directory with fixed-height section headers.",
                href: "/countries-with-headers-fixed",
                title: "Countries With Headers Fixed",
            },
            {
                description: "Grouped directory with sticky section headers.",
                href: "/countries-with-headers-sticky",
                title: "Countries With Headers Sticky",
            },
            {
                description: "Exercises row reordering while preserving list state.",
                href: "/countries-reorder",
                title: "Countries Reorder",
            },
            {
                description: "Compares the same directory workload against FlashList.",
                href: "/countries-flashlist",
                title: "Countries FlashList",
            },
            {
                description: "Checks multi-column measurement and placement behavior.",
                href: "/columns",
                title: "Columns",
            },
            {
                description: "Renders card-style content in a multi-column layout.",
                href: "/cards-columns",
                title: "Cards Columns",
            },
            {
                description: "Forces external state updates through visible cells.",
                href: "/extra-data",
                title: "Extra Data",
            },
            {
                description: "Filters rendered elements without rebuilding all rows.",
                href: "/filter-elements",
                title: "Filter Elements",
            },
            {
                description: "Updates cell state in place to confirm recycle safety.",
                href: "/mutable-cells",
                title: "Mutable Cells",
            },
            {
                description: "Exercises layout transitions while rows mount and move.",
                href: "/layout-animation",
                title: "Layout Animation",
            },
        ],
        key: "data",
        title: "Data & Layout",
    },
    {
        entries: [
            {
                description: "Compares card-feed behavior against FlashList.",
                href: "/cards-flashlist",
                title: "Cards FlashList",
            },
            {
                description: "Compares the same card feed against FlatList.",
                href: "/cards-flatlist",
                title: "Cards FlatList",
            },
            {
                description: "Shows card-feed behavior with recycling disabled.",
                href: "/cards-no-recycle",
                title: "Cards No Recycle",
            },
            {
                description: "Compares a media-heavy list against FlashList.",
                href: "/movies-flashlist",
                title: "Movies FlashList",
            },
            { description: "Mixed-content card feed tuned for LegendList.", href: "/cards", title: "Cards" },
            {
                description: "Media browsing layout with posters and dense metadata.",
                href: "/moviesL",
                title: "Movies",
            },
            {
                description: "Media browsing layout with aggressive cell recycling.",
                href: "/moviesLR",
                title: "Movies Recycle",
            },
            {
                description: "Commerce-style shelf with sticky headers and product cards.",
                href: "/product-shelf",
                title: "Product Shelf",
            },
            {
                description: "Full-screen paging feed with viewport-sized items.",
                href: "/video-feed",
                title: "Video Feed",
            },
        ],
        key: "comparison",
        title: "Comparisons & Media",
    },
];
