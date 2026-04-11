import type { ExampleMeta } from "./types";
export type { CatalogGroup, CatalogTag, ExampleMeta, ExampleSlug } from "./types";

export const CURATED_EXAMPLES: ExampleMeta[] = [
    { group: "Messaging", slug: "chat", tags: ["Chat", "Append"], title: "Chat" },
    { group: "Messaging", slug: "ai-chat", tags: ["AI", "Streaming", "Chat"], title: "AI Chat" },
    { group: "Directory", slug: "directory", tags: ["Directory", "Search"], title: "Directory" },
    {
        group: "Directory",
        slug: "sectioned-directory",
        tags: ["Directory", "Grouped", "Sticky Headers"],
        title: "Sectioned Directory",
    },
    { group: "Commerce", slug: "product-shelf", tags: ["Columns", "Sticky Headers"], title: "Product Shelf" },
    { group: "Commerce", slug: "cards-feed", tags: ["Append"], title: "Cards Feed" },
    { group: "Media", slug: "media-rails", tags: ["Horizontal"], title: "Media Rails" },
    { group: "Media", slug: "video-feed", tags: ["Paging"], title: "Video Feed" },
    { group: "Messaging", slug: "notifications-inbox", tags: ["Append"], title: "Notifications Inbox" },
    { group: "Directory", slug: "activity-history", tags: ["Bidirectional"], title: "Activity History" },
    { group: "Commerce", slug: "gallery-grid", tags: ["Grid", "Columns"], title: "Gallery Grid" },
    {
        group: "Media",
        slug: "infinite-calendar",
        tags: ["Calendar", "Horizontal", "Paging"],
        title: "Infinite Calendar",
    },
];

export const CURATED_GROUP_ORDER = ["Messaging", "Directory", "Commerce", "Media"] as const;
