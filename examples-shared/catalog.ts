import type { ExampleMeta } from "./types";
export type { CatalogGroup, CatalogTag, ExampleMeta, ExampleSlug } from "./types";

export const CURATED_EXAMPLES: ExampleMeta[] = [
    {
        description: "Real-time messaging with auto-scroll anchoring and append stability.",
        group: "Messaging",
        slug: "chat",
        tags: ["Chat", "Append"],
        title: "Chat",
    },
    {
        description: "Streaming AI responses with token-by-token rendering.",
        group: "Messaging",
        slug: "ai-chat",
        tags: ["AI", "Streaming", "Chat"],
        title: "AI Chat",
    },
    {
        description: "Searchable contact list with instant filtering.",
        group: "Directory",
        slug: "directory",
        tags: ["Directory", "Search"],
        title: "Directory",
    },
    {
        description: "Grouped contacts with persistent sticky section headers.",
        group: "Directory",
        slug: "sectioned-directory",
        tags: ["Directory", "Grouped", "Sticky Headers"],
        title: "Sectioned Directory",
    },
    {
        description: "Multi-column grid with full-width sticky section headers.",
        group: "Commerce",
        slug: "product-shelf",
        tags: ["Columns", "Sticky Headers"],
        title: "Product Shelf",
    },
    {
        description: "Rich mixed-content feed with recycled interactive state.",
        group: "Commerce",
        slug: "cards-feed",
        tags: ["Append"],
        title: "Cards Feed",
    },
    {
        description: "Nested horizontal carousels inside a vertical list.",
        group: "Media",
        slug: "media-rails",
        tags: ["Horizontal"],
        title: "Media Rails",
    },
    {
        description: "Full-screen paging feed with viewport-sized items.",
        group: "Media",
        slug: "video-feed",
        tags: ["Paging"],
        title: "Video Feed",
    },
    {
        description: "Prepend-driven inbox with unread state and live additions.",
        group: "Messaging",
        slug: "notifications-inbox",
        tags: ["Append"],
        title: "Notifications Inbox",
    },
    {
        description: "Bidirectional transaction feed with live status updates.",
        group: "Directory",
        slug: "activity-history",
        tags: ["Bidirectional"],
        title: "Activity History",
    },
    {
        description: "Responsive grid with dynamic column count switching.",
        group: "Commerce",
        slug: "gallery-grid",
        tags: ["Grid", "Columns"],
        title: "Gallery Grid",
    },
    {
        description: "Bidirectional infinite scrolling with month-based pagination.",
        group: "Media",
        slug: "infinite-calendar",
        tags: ["Calendar", "Horizontal", "Paging"],
        title: "Infinite Calendar",
    },
];

export const CURATED_GROUP_ORDER = ["Messaging", "Directory", "Commerce", "Media"] as const;
