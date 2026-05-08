import type { ExampleSlug } from "@examples/types";
import { ActivityHistoryExample } from "./ActivityHistoryExample";
import { AiChatExample } from "./AiChatExample";
import { CardsFeedExample } from "./CardsFeedExample";
import { ChatExample } from "./ChatExample";
import { DirectoryExample } from "./DirectoryExample";
import { GalleryGridExample } from "./GalleryGridExample";
import { InfiniteCalendarExample } from "./InfiniteCalendarExample";
import { MediaRailsExample } from "./MediaRailsExample";
import { NotificationsInboxExample } from "./NotificationsInboxExample";
import { ProductShelfExample } from "./ProductShelfExample";
import { SectionedDirectoryExample } from "./SectionedDirectoryExample";
import { VideoFeedExample } from "./VideoFeedExample";

export function renderExample(slug: ExampleSlug) {
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
