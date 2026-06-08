import type React from "react";

import LibraryBenchmarkExample from "../examples/LibraryBenchmarkExample";
import AccurateScrollToExample from "./AccurateScrollToExample";
import AccurateScrollToHugeExample from "./AccurateScrollToHugeExample";
import AddToEndExample from "./AddToEndExample";
import AiChatFloatingComposerExample from "./AiChatFloatingComposerExample";
import AlwaysRenderExample from "./AlwaysRenderExample";
import BidirectionalInfiniteListExample from "./BidirectionalInfiniteListExample";
import ChatExample from "./ChatExample";
import ChatFloatingComposerExample from "./ChatFloatingComposerExample";
import ColumnsExample from "./ColumnsExample";
import CountriesExample from "./CountriesExample";
import CountriesWithHeadersStickyExample from "./CountriesWithHeadersStickyExample";
import ExtraDataExample from "./ExtraDataExample";
import FixedSizeItemsExample from "./FixedSizeItemsExample";
import InitialScrollAtEndExample from "./InitialScrollAtEndExample";
import InitialScrollIndexExample from "./InitialScrollIndexExample";
import LazyListExample from "./LazyListExample";
import MutableCellsExample from "./MutableCellsExample";
import MVCPTestExample from "./MVCPTestExample";
import PrependLargeItemsJumpExample from "./PrependLargeItemsJumpExample";
import PrependMvcpJumpExample from "./PrependMvcpJumpExample";
import SnapToIndicesExample from "./SnapToIndicesExample";
import WindowScrollExample from "./WindowScrollExample";

export type FixtureRoute = {
    description: string;
    element: () => React.ReactNode;
    group: string;
    path: string;
    title: string;
    usesWindowScroll?: boolean;
};

export const FIXTURE_ROUTES: FixtureRoute[] = [
    {
        description: "Verifies indexed scrollTo accuracy on variable-height content.",
        element: () => <AccurateScrollToExample />,
        group: "Scroll & Position",
        path: "accurate-scrollto",
        title: "Accurate ScrollTo",
    },
    {
        description: "Stress-tests scrollTo accuracy deep into a very large dataset.",
        element: () => <AccurateScrollToHugeExample />,
        group: "Scroll & Position",
        path: "accurate-scrollto-huge",
        title: "Accurate ScrollTo Huge",
    },
    {
        description: "Appends new rows while keeping the viewport stable at the end.",
        element: () => <AddToEndExample />,
        group: "Scroll & Position",
        path: "add-to-end",
        title: "Add To End",
    },
    {
        description: "Keeps nearby cells mounted to inspect render-window behavior.",
        element: () => <AlwaysRenderExample />,
        group: "Scroll & Position",
        path: "always-render",
        title: "Always Render",
    },
    {
        description: "Exercises prepend and append pagination in the same list.",
        element: () => <BidirectionalInfiniteListExample />,
        group: "Scroll & Position",
        path: "bidirectional-infinite-list",
        title: "Bidirectional Infinite List",
    },
    {
        description: "Checks multi-column measurement and placement behavior.",
        element: () => <ColumnsExample />,
        group: "Data & Layout",
        path: "columns",
        title: "Columns",
    },
    {
        description: "Searchable directory with dynamic filtering.",
        element: () => <CountriesExample />,
        group: "Data & Layout",
        path: "countries",
        title: "Countries",
    },
    {
        description: "Grouped directory with sticky section headers.",
        element: () => <CountriesWithHeadersStickyExample />,
        group: "Data & Layout",
        path: "countries-with-headers-sticky",
        title: "Countries With Headers Sticky",
    },
    {
        description: "Forces external state updates through visible cells.",
        element: () => <ExtraDataExample />,
        group: "Data & Layout",
        path: "extra-data",
        title: "Extra Data",
    },
    {
        description: "Validates sizing when every row uses the same height.",
        element: () => <FixedSizeItemsExample />,
        group: "Scroll & Position",
        path: "fixed-size-items",
        title: "Fixed Size Items",
    },
    {
        description: "Starts the list at a target index and checks landing accuracy.",
        element: () => <InitialScrollIndexExample />,
        group: "Scroll & Position",
        path: "initial-scroll-index",
        title: "Initial Scroll Index",
    },
    {
        description: "Starts at the end of the list and checks bottom-aligned landing behavior.",
        element: () => <InitialScrollAtEndExample />,
        group: "Scroll & Position",
        path: "initial-scroll-at-end",
        title: "Initial Scroll At End",
    },
    {
        description: "Defers rendering until rows are needed near the viewport.",
        element: () => <LazyListExample />,
        group: "Scroll & Position",
        path: "lazy-list",
        title: "Lazy List",
    },
    {
        description: "Updates cell state in place to confirm recycle safety.",
        element: () => <MutableCellsExample />,
        group: "Data & Layout",
        path: "mutable-cells",
        title: "Mutable Cells",
    },
    {
        description: "Regression surface for maintain-visible-content-position behavior.",
        element: () => <MVCPTestExample />,
        group: "Scroll & Position",
        path: "mvcp-test",
        title: "MVCP Test",
    },
    {
        description: "Reproduces prepend jumps with large inserted items.",
        element: () => <PrependLargeItemsJumpExample />,
        group: "Scroll & Position",
        path: "prepend-large-items-jump",
        title: "Prepend Large Items Jump",
    },
    {
        description: "Repro: prepending older messages breaks maintain-visible-content-position.",
        element: () => <PrependMvcpJumpExample />,
        group: "Scroll & Position",
        path: "prepend-mvcp-jump",
        title: "Prepend MVCP Jump",
    },
    {
        description: "Exercises web CSS snapping for virtualized horizontal snap targets.",
        element: () => <SnapToIndicesExample />,
        group: "Scroll & Position",
        path: "snap-to-indices",
        title: "Snap To Indices",
    },
    {
        description: "Compares LegendList behavior against a simple virtual list baseline.",
        element: () => <LibraryBenchmarkExample />,
        group: "Comparisons",
        path: "virtual-list-comparison",
        title: "Virtual List Comparison",
    },
    {
        description: "Runs LegendList against the browser window scroller.",
        element: () => <WindowScrollExample />,
        group: "Comparisons",
        path: "window-scroll",
        title: "Window Scroll",
        usesWindowScroll: true,
    },
    {
        description: "Chat-style timeline with anchored auto-scroll behavior.",
        element: () => <ChatExample />,
        group: "Chat & Messaging",
        path: "chat-example",
        title: "Chat Example",
    },
    {
        description: "Chat-style timeline with a measured floating composer overlay.",
        element: () => <ChatFloatingComposerExample />,
        group: "Chat & Messaging",
        path: "chat-floating-composer",
        title: "Chat Floating Composer",
    },
    {
        description: "AI chat-style timeline with anchored end space and a measured floating composer overlay.",
        element: () => <AiChatFloatingComposerExample />,
        group: "Chat & Messaging",
        path: "ai-chat-floating-composer",
        title: "AI Chat Floating Composer",
    },
];

export const FIXTURE_GROUPS = Array.from(new Set(FIXTURE_ROUTES.map((route) => route.group)));
