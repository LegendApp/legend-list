import React from "react";
import { Text } from "react-native";

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
import { Shell } from "./shared";
import { VideoFeedExample } from "./VideoFeedExample";

export * from "./ActivityHistoryExample";
export * from "./AiChatExample";
export * from "./CardsFeedExample";
export * from "./ChatExample";
export * from "./DirectoryExample";
export * from "./GalleryGridExample";
export * from "./InfiniteCalendarExample";
export * from "./MediaRailsExample";
export * from "./NotificationsInboxExample";
export * from "./ProductShelfExample";
export * from "./SectionedDirectoryExample";
export * from "./VideoFeedExample";

export function renderCuratedExample(slug: string) {
    switch (slug) {
        case "chat":
            return React.createElement(ChatExample);
        case "ai-chat":
            return React.createElement(AiChatExample);
        case "directory":
            return React.createElement(DirectoryExample);
        case "sectioned-directory":
            return React.createElement(SectionedDirectoryExample);
        case "product-shelf":
            return React.createElement(ProductShelfExample);
        case "cards-feed":
            return React.createElement(CardsFeedExample);
        case "media-rails":
            return React.createElement(MediaRailsExample);
        case "video-feed":
            return React.createElement(VideoFeedExample);
        case "notifications-inbox":
            return React.createElement(NotificationsInboxExample);
        case "activity-history":
            return React.createElement(ActivityHistoryExample);
        case "gallery-grid":
            return React.createElement(GalleryGridExample);
        case "infinite-calendar":
            return React.createElement(InfiniteCalendarExample);
        default:
            return React.createElement(Shell, null, React.createElement(Text, null, `Unknown example: ${slug}`));
    }
}
