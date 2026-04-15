import type { ExampleSlug } from "@examples/types";
import { ActivityHistoryExample } from "./curated/ActivityHistoryExample";
import { AiChatExample } from "./curated/AiChatExample";
import { CardsFeedExample } from "./curated/CardsFeedExample";
import { ChatExample } from "./curated/ChatExample";
import { DirectoryExample } from "./curated/DirectoryExample";
import { GalleryGridExample } from "./curated/GalleryGridExample";
import { InfiniteCalendarExample } from "./curated/InfiniteCalendarExample";
import { MediaRailsExample } from "./curated/MediaRailsExample";
import { NotificationsInboxExample } from "./curated/NotificationsInboxExample";
import { ProductShelfExample } from "./curated/ProductShelfExample";
import { SectionedDirectoryExample } from "./curated/SectionedDirectoryExample";
import { VideoFeedExample } from "./curated/VideoFeedExample";

export function renderCuratedExample(slug: ExampleSlug) {
    switch (slug) {
        case "chat":
            return <ChatExample />;
        case "ai-chat":
            return <AiChatExample />;
        case "directory":
            return <DirectoryExample />;
        case "sectioned-directory":
            return <SectionedDirectoryExample />;
        case "product-shelf":
            return <ProductShelfExample />;
        case "cards-feed":
            return <CardsFeedExample />;
        case "media-rails":
            return <MediaRailsExample />;
        case "video-feed":
            return <VideoFeedExample />;
        case "notifications-inbox":
            return <NotificationsInboxExample />;
        case "activity-history":
            return <ActivityHistoryExample />;
        case "gallery-grid":
            return <GalleryGridExample />;
        case "infinite-calendar":
            return <InfiniteCalendarExample />;
        default:
            return null;
    }
}
