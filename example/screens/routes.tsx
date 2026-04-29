import type { ComponentType } from "react";

import { CURATED_EXAMPLES, CURATED_GROUP_ORDER, type ExampleSlug } from "@examples/catalog";
import type { CatalogGroup } from "~/lib/catalogTypes";
import { ActivityHistoryExample } from "~/screens/examples/ActivityHistoryExample";
import { AiChatExample } from "~/screens/examples/AiChatExample";
import { CardsFeedExample } from "~/screens/examples/CardsFeedExample";
import { ChatExample } from "~/screens/examples/ChatExample";
import { DirectoryExample } from "~/screens/examples/DirectoryExample";
import { GalleryGridExample } from "~/screens/examples/GalleryGridExample";
import { InfiniteCalendarExample } from "~/screens/examples/InfiniteCalendarExample";
import { MediaRailsExample } from "~/screens/examples/MediaRailsExample";
import { NotificationsInboxExample } from "~/screens/examples/NotificationsInboxExample";
import { ProductShelfExample } from "~/screens/examples/ProductShelfExample";
import { SectionedDirectoryExample } from "~/screens/examples/SectionedDirectoryExample";
import { VideoFeedExample } from "~/screens/examples/VideoFeedExample";
import AccurateScrollToFixture from "~/screens/fixtures/accurate-scrollto";
import AccurateScrollTo2Fixture from "~/screens/fixtures/accurate-scrollto-2";
import AccurateScrollToHugeFixture from "~/screens/fixtures/accurate-scrollto-huge";
import AddToEndFixture from "~/screens/fixtures/add-to-end";
import ActivityAiChatKeyboardFixture from "~/screens/fixtures/ai-chat-keyboard";
import AlwaysRenderFixture from "~/screens/fixtures/always-render";
import BidirectionalInfiniteListFixture from "~/screens/fixtures/bidirectional-infinite-list";
import CardsFixture from "~/screens/fixtures/cards";
import CardsColumnsFixture from "~/screens/fixtures/cards-columns";
import CardsFlashListFixture from "~/screens/fixtures/cards-flashlist";
import CardsFlatListFixture from "~/screens/fixtures/cards-flatlist";
import CardsNoRecycleFixture from "~/screens/fixtures/cards-no-recycle";
import ChatExampleFixture from "~/screens/fixtures/chat-example";
import ChatInfiniteFixture from "~/screens/fixtures/chat-infinite";
import ChatKeyboardFixture from "~/screens/fixtures/chat-keyboard";
import ChatKeyboardBigFixture from "~/screens/fixtures/chat-keyboard-big";
import ChatResizeOuterFixture from "~/screens/fixtures/chat-resize-outer";
import ColumnsFixture from "~/screens/fixtures/columns";
import CountriesFixture from "~/screens/fixtures/countries";
import CountriesFlashListFixture from "~/screens/fixtures/countries-flashlist";
import CountriesReorderFixture from "~/screens/fixtures/countries-reorder";
import CountriesWithHeadersFixture from "~/screens/fixtures/countries-with-headers";
import CountriesWithHeadersFixedFixture from "~/screens/fixtures/countries-with-headers-fixed";
import CountriesWithHeadersStickyFixture from "~/screens/fixtures/countries-with-headers-sticky";
import ExtraDataFixture from "~/screens/fixtures/extra-data";
import FilterElementsFixture from "~/screens/fixtures/filter-elements";
import InitialScrollAtEndEmptyFixture from "~/screens/fixtures/initial-scroll-at-end-empty";
import InitialScrollIndexFixture from "~/screens/fixtures/initial-scroll-index";
import InitialScrollIndexFreeHeightFixture from "~/screens/fixtures/initial-scroll-index-free-height";
import InitialScrollIndexKeyedFixture from "~/screens/fixtures/initial-scroll-index-keyed";
import InitialScrollStartAtTheEndFixture from "~/screens/fixtures/initial-scroll-start-at-the-end";
import LargeListRenderTimeFixture from "~/screens/fixtures/large-list-render-time";
import LayoutAnimationFixture from "~/screens/fixtures/layout-animation";
import LazyListFixture from "~/screens/fixtures/lazy-list";
import MoviesFlashListFixture from "~/screens/fixtures/movies-flashlist";
import MoviesLFixture from "~/screens/fixtures/moviesL";
import MoviesLRFixture from "~/screens/fixtures/moviesLR";
import MutableCellsFixture from "~/screens/fixtures/mutable-cells";
import MvcpTestFixture from "~/screens/fixtures/mvcp-test";
import ProductShelfFixture from "~/screens/fixtures/product-shelf";
import VideoFeedFixture from "~/screens/fixtures/video-feed";
import AiChatFixture from "./fixtures/ai-chat";

type ScreenComponent = ComponentType;

type RouteDefinition = {
    component: ScreenComponent;
    description: string;
    slug: string;
    title: string;
};

type ExampleRouteDefinition = RouteDefinition & {
    group: (typeof CURATED_GROUP_ORDER)[number];
    kind: "example";
};

type FixtureRouteDefinition = RouteDefinition & {
    groupKey: "chat" | "comparison" | "data" | "scroll";
    groupTitle: string;
    kind: "fixture";
};

function CardsFeedExampleRoute() {
    return <CardsFeedExample />;
}

const exampleComponents = {
    "activity-history": ActivityHistoryExample,
    "ai-chat": AiChatExample,
    "cards-feed": CardsFeedExampleRoute,
    chat: ChatExample,
    directory: DirectoryExample,
    "gallery-grid": GalleryGridExample,
    "infinite-calendar": InfiniteCalendarExample,
    "media-rails": MediaRailsExample,
    "notifications-inbox": NotificationsInboxExample,
    "product-shelf": ProductShelfExample,
    "sectioned-directory": SectionedDirectoryExample,
    "video-feed": VideoFeedExample,
} satisfies Record<ExampleSlug, ScreenComponent>;

export const EXAMPLE_ROUTES: ExampleRouteDefinition[] = CURATED_EXAMPLES.map((example) => ({
    component: exampleComponents[example.slug],
    description: example.description,
    group: example.group,
    kind: "example",
    slug: example.slug,
    title: example.title,
}));

export const FIXTURE_ROUTES: FixtureRouteDefinition[] = [
    {
        component: AccurateScrollToFixture,
        description: "Verifies indexed scrollTo accuracy on variable-height content.",
        groupKey: "scroll",
        groupTitle: "Scroll & Position",
        kind: "fixture",
        slug: "accurate-scrollto",
        title: "Accurate ScrollTo",
    },
    {
        component: AccurateScrollTo2Fixture,
        description: "Alternate scrollTo surface for validating index landing behavior.",
        groupKey: "scroll",
        groupTitle: "Scroll & Position",
        kind: "fixture",
        slug: "accurate-scrollto-2",
        title: "Accurate ScrollTo 2",
    },
    {
        component: AccurateScrollToHugeFixture,
        description: "Stress-tests scrollTo accuracy deep into a very large dataset.",
        groupKey: "scroll",
        groupTitle: "Scroll & Position",
        kind: "fixture",
        slug: "accurate-scrollto-huge",
        title: "Accurate ScrollTo Huge",
    },
    {
        component: InitialScrollIndexFixture,
        description: "Starts the list at a target index and checks landing accuracy.",
        groupKey: "scroll",
        groupTitle: "Scroll & Position",
        kind: "fixture",
        slug: "initial-scroll-index",
        title: "Initial Scroll Index",
    },
    {
        component: InitialScrollIndexFreeHeightFixture,
        description: "Tests initial scroll landing when rows measure to free height.",
        groupKey: "scroll",
        groupTitle: "Scroll & Position",
        kind: "fixture",
        slug: "initial-scroll-index-free-height",
        title: "Initial Scroll Index Free Height",
    },
    {
        component: InitialScrollIndexKeyedFixture,
        description: "Validates initial index landing when keys drive row identity.",
        groupKey: "scroll",
        groupTitle: "Scroll & Position",
        kind: "fixture",
        slug: "initial-scroll-index-keyed",
        title: "Initial Scroll Index Keyed",
    },
    {
        component: InitialScrollStartAtTheEndFixture,
        description: "Starts from the end of the list and checks anchored positioning.",
        groupKey: "scroll",
        groupTitle: "Scroll & Position",
        kind: "fixture",
        slug: "initial-scroll-start-at-the-end",
        title: "Initial Scroll Start At End",
    },
    {
        component: InitialScrollAtEndEmptyFixture,
        description: "Checks starting at the end before any rows have been appended.",
        groupKey: "scroll",
        groupTitle: "Scroll & Position",
        kind: "fixture",
        slug: "initial-scroll-at-end-empty",
        title: "Initial Scroll End Empty",
    },
    {
        component: AddToEndFixture,
        description: "Appends new rows while keeping the viewport stable at the end.",
        groupKey: "scroll",
        groupTitle: "Scroll & Position",
        kind: "fixture",
        slug: "add-to-end",
        title: "Add To End",
    },
    {
        component: BidirectionalInfiniteListFixture,
        description: "Exercises prepend and append pagination in the same list.",
        groupKey: "scroll",
        groupTitle: "Scroll & Position",
        kind: "fixture",
        slug: "bidirectional-infinite-list",
        title: "Bidirectional Infinite List",
    },
    {
        component: MvcpTestFixture,
        description: "Regression surface for maintain-visible-content-position behavior.",
        groupKey: "scroll",
        groupTitle: "Scroll & Position",
        kind: "fixture",
        slug: "mvcp-test",
        title: "MVCP Test",
    },
    {
        component: AlwaysRenderFixture,
        description: "Keeps nearby cells mounted to inspect render-window behavior.",
        groupKey: "scroll",
        groupTitle: "Scroll & Position",
        kind: "fixture",
        slug: "always-render",
        title: "Always Render",
    },
    {
        component: LazyListFixture,
        description: "Defers rendering until rows are needed near the viewport.",
        groupKey: "scroll",
        groupTitle: "Scroll & Position",
        kind: "fixture",
        slug: "lazy-list",
        title: "Lazy List",
    },
    {
        component: ChatExampleFixture,
        description: "Chat-style timeline with anchored auto-scroll behavior.",
        groupKey: "chat",
        groupTitle: "Chat & Keyboard",
        kind: "fixture",
        slug: "chat-example",
        title: "Chat Example",
    },
    {
        component: ChatInfiniteFixture,
        description: "Loads older messages as you scroll through an infinite chat.",
        groupKey: "chat",
        groupTitle: "Chat & Keyboard",
        kind: "fixture",
        slug: "chat-infinite",
        title: "Chat Infinite",
    },
    {
        component: ChatKeyboardFixture,
        description: "Checks chat input and keyboard avoidance together.",
        groupKey: "chat",
        groupTitle: "Chat & Keyboard",
        kind: "fixture",
        slug: "chat-keyboard",
        title: "Chat Keyboard",
    },
    {
        component: ChatKeyboardBigFixture,
        description: "Exercises keyboard handling with a taller composer.",
        groupKey: "chat",
        groupTitle: "Chat & Keyboard",
        kind: "fixture",
        slug: "chat-keyboard-big",
        title: "Chat Keyboard Big",
    },
    {
        component: ChatResizeOuterFixture,
        description: "Validates chat layout when an outer container resizes.",
        groupKey: "chat",
        groupTitle: "Chat & Keyboard",
        kind: "fixture",
        slug: "chat-resize-outer",
        title: "Chat Resize Outer",
    },
    {
        component: AiChatFixture,
        description: "Streams AI responses into a chat timeline.",
        groupKey: "chat",
        groupTitle: "Chat & Keyboard",
        kind: "fixture",
        slug: "ai-chat-fixture",
        title: "AI Chat Fixture",
    },
    {
        component: ActivityAiChatKeyboardFixture,
        description: "Combines AI streaming with keyboard-safe chat input.",
        groupKey: "chat",
        groupTitle: "Chat & Keyboard",
        kind: "fixture",
        slug: "ai-chat-keyboard",
        title: "AI Keyboard Chat",
    },
    {
        component: CountriesFixture,
        description: "Searchable directory with dynamic filtering.",
        groupKey: "data",
        groupTitle: "Data & Layout",
        kind: "fixture",
        slug: "countries",
        title: "Countries",
    },
    {
        component: CountriesWithHeadersFixture,
        description: "Grouped directory with section headers between regions.",
        groupKey: "data",
        groupTitle: "Data & Layout",
        kind: "fixture",
        slug: "countries-with-headers",
        title: "Countries With Headers",
    },
    {
        component: CountriesWithHeadersFixedFixture,
        description: "Grouped directory with fixed-height section headers.",
        groupKey: "data",
        groupTitle: "Data & Layout",
        kind: "fixture",
        slug: "countries-with-headers-fixed",
        title: "Countries With Headers Fixed",
    },
    {
        component: CountriesWithHeadersStickyFixture,
        description: "Grouped directory with sticky section headers.",
        groupKey: "data",
        groupTitle: "Data & Layout",
        kind: "fixture",
        slug: "countries-with-headers-sticky",
        title: "Countries With Headers Sticky",
    },
    {
        component: CountriesReorderFixture,
        description: "Exercises row reordering while preserving list state.",
        groupKey: "data",
        groupTitle: "Data & Layout",
        kind: "fixture",
        slug: "countries-reorder",
        title: "Countries Reorder",
    },
    {
        component: CountriesFlashListFixture,
        description: "Compares the same directory workload against FlashList.",
        groupKey: "data",
        groupTitle: "Data & Layout",
        kind: "fixture",
        slug: "countries-flashlist",
        title: "Countries FlashList",
    },
    {
        component: ColumnsFixture,
        description: "Checks multi-column measurement and placement behavior.",
        groupKey: "data",
        groupTitle: "Data & Layout",
        kind: "fixture",
        slug: "columns",
        title: "Columns",
    },
    {
        component: CardsColumnsFixture,
        description: "Renders card-style content in a multi-column layout.",
        groupKey: "data",
        groupTitle: "Data & Layout",
        kind: "fixture",
        slug: "cards-columns",
        title: "Cards Columns",
    },
    {
        component: ExtraDataFixture,
        description: "Forces external state updates through visible cells.",
        groupKey: "data",
        groupTitle: "Data & Layout",
        kind: "fixture",
        slug: "extra-data",
        title: "Extra Data",
    },
    {
        component: FilterElementsFixture,
        description: "Filters rendered elements without rebuilding all rows.",
        groupKey: "data",
        groupTitle: "Data & Layout",
        kind: "fixture",
        slug: "filter-elements",
        title: "Filter Elements",
    },
    {
        component: MutableCellsFixture,
        description: "Updates cell state in place to confirm recycle safety.",
        groupKey: "data",
        groupTitle: "Data & Layout",
        kind: "fixture",
        slug: "mutable-cells",
        title: "Mutable Cells",
    },
    {
        component: LayoutAnimationFixture,
        description: "Exercises layout transitions while rows mount and move.",
        groupKey: "data",
        groupTitle: "Data & Layout",
        kind: "fixture",
        slug: "layout-animation",
        title: "Layout Animation",
    },
    {
        component: LargeListRenderTimeFixture,
        description: "Measures onLoad timing for a large estimated-size list.",
        groupKey: "data",
        groupTitle: "Data & Layout",
        kind: "fixture",
        slug: "large-list-render-time",
        title: "Large List Render Time",
    },
    {
        component: CardsFlashListFixture,
        description: "Compares card-feed behavior against FlashList.",
        groupKey: "comparison",
        groupTitle: "Comparisons & Media",
        kind: "fixture",
        slug: "cards-flashlist",
        title: "Cards FlashList",
    },
    {
        component: CardsFlatListFixture,
        description: "Compares the same card feed against FlatList.",
        groupKey: "comparison",
        groupTitle: "Comparisons & Media",
        kind: "fixture",
        slug: "cards-flatlist",
        title: "Cards FlatList",
    },
    {
        component: CardsNoRecycleFixture,
        description: "Shows card-feed behavior with recycling disabled.",
        groupKey: "comparison",
        groupTitle: "Comparisons & Media",
        kind: "fixture",
        slug: "cards-no-recycle",
        title: "Cards No Recycle",
    },
    {
        component: MoviesFlashListFixture,
        description: "Compares a media-heavy list against FlashList.",
        groupKey: "comparison",
        groupTitle: "Comparisons & Media",
        kind: "fixture",
        slug: "movies-flashlist",
        title: "Movies FlashList",
    },
    {
        component: CardsFixture,
        description: "Mixed-content card feed tuned for LegendList.",
        groupKey: "comparison",
        groupTitle: "Comparisons & Media",
        kind: "fixture",
        slug: "cards",
        title: "Cards",
    },
    {
        component: MoviesLFixture,
        description: "Media browsing layout with posters and dense metadata.",
        groupKey: "comparison",
        groupTitle: "Comparisons & Media",
        kind: "fixture",
        slug: "moviesL",
        title: "Movies",
    },
    {
        component: MoviesLRFixture,
        description: "Media browsing layout with aggressive cell recycling.",
        groupKey: "comparison",
        groupTitle: "Comparisons & Media",
        kind: "fixture",
        slug: "moviesLR",
        title: "Movies Recycle",
    },
    {
        component: ProductShelfFixture,
        description: "Commerce-style shelf with sticky headers and product cards.",
        groupKey: "comparison",
        groupTitle: "Comparisons & Media",
        kind: "fixture",
        slug: "product-shelf-fixture",
        title: "Product Shelf Fixture",
    },
    {
        component: VideoFeedFixture,
        description: "Full-screen paging feed with viewport-sized items.",
        groupKey: "comparison",
        groupTitle: "Comparisons & Media",
        kind: "fixture",
        slug: "video-feed-fixture",
        title: "Video Feed Fixture",
    },
];

const ALL_ROUTES = [...EXAMPLE_ROUTES, ...FIXTURE_ROUTES];
const ROUTE_MAP = new Map(ALL_ROUTES.map((route) => [route.slug, route]));

if (ROUTE_MAP.size !== ALL_ROUTES.length) {
    throw new Error("Duplicate example route slug detected.");
}

export function getRouteBySlug(slug: string) {
    return ROUTE_MAP.get(slug);
}

export const EXAMPLE_CATALOG: CatalogGroup[] = CURATED_GROUP_ORDER.map((group) => ({
    entries: EXAMPLE_ROUTES.filter((route) => route.group === group).map((route) => ({
        description: route.description,
        href: `/${route.slug}`,
        title: route.title,
    })),
    key: group.toLowerCase(),
    title: group,
}));

const FIXTURE_GROUP_ORDER = [
    { key: "scroll", title: "Scroll & Position" },
    { key: "chat", title: "Chat & Keyboard" },
    { key: "data", title: "Data & Layout" },
    { key: "comparison", title: "Comparisons & Media" },
] as const;

export const FIXTURE_CATALOG: CatalogGroup[] = FIXTURE_GROUP_ORDER.map((group) => ({
    entries: FIXTURE_ROUTES.filter((route) => route.groupKey === group.key).map((route) => ({
        description: route.description,
        href: `/${route.slug}`,
        title: route.title,
    })),
    key: group.key,
    title: group.title,
}));
