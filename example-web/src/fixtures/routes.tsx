import React from "react";

import AccurateScrollToExample from "../examples/AccurateScrollToExample";
import AccurateScrollToHugeExample from "../examples/AccurateScrollToHugeExample";
import AddToEndExample from "../examples/AddToEndExample";
import AlwaysRenderExample from "../examples/AlwaysRenderExample";
import BidirectionalInfiniteListExample from "../examples/BidirectionalInfiniteListExample";
import ChatExample from "../examples/ChatExample";
import ColumnsExample from "../examples/ColumnsExample";
import CountriesExample from "../examples/CountriesExample";
import CountriesWithHeadersStickyExample from "../examples/CountriesWithHeadersStickyExample";
import ExtraDataExample from "../examples/ExtraDataExample";
import FixedSizeItemsExample from "../examples/FixedSizeItemsExample";
import InitialScrollIndexExample from "../examples/InitialScrollIndexExample";
import LazyListExample from "../examples/LazyListExample";
import MutableCellsExample from "../examples/MutableCellsExample";
import MVCPTestExample from "../examples/MVCPTestExample";
import PrependLargeItemsJumpExample from "../examples/PrependLargeItemsJumpExample";
import VirtualListComparison from "../examples/VirtualListComparison";
import WindowScrollExample from "../examples/WindowScrollExample";

export type FixtureRoute = {
    element: () => React.ReactNode;
    group: string;
    path: string;
    tags: string[];
    title: string;
    usesWindowScroll?: boolean;
};

export const FIXTURE_ROUTES: FixtureRoute[] = [
    {
        element: () => <AccurateScrollToExample />,
        group: "Scroll & Position",
        path: "accurate-scrollto",
        tags: ["Scroll", "Index"],
        title: "Accurate ScrollTo",
    },
    {
        element: () => <AccurateScrollToHugeExample />,
        group: "Scroll & Position",
        path: "accurate-scrollto-huge",
        tags: ["Scroll", "Large Data"],
        title: "Accurate ScrollTo Huge",
    },
    {
        element: () => <AddToEndExample />,
        group: "Scroll & Position",
        path: "add-to-end",
        tags: ["Append"],
        title: "Add To End",
    },
    {
        element: () => <AlwaysRenderExample />,
        group: "Scroll & Position",
        path: "always-render",
        tags: ["Rendering"],
        title: "Always Render",
    },
    {
        element: () => <BidirectionalInfiniteListExample />,
        group: "Scroll & Position",
        path: "bidirectional-infinite-list",
        tags: ["Bidirectional"],
        title: "Bidirectional Infinite List",
    },
    {
        element: () => <ColumnsExample />,
        group: "Data & Layout",
        path: "columns",
        tags: ["Columns"],
        title: "Columns",
    },
    {
        element: () => <CountriesExample />,
        group: "Data & Layout",
        path: "countries",
        tags: ["Directory", "Search"],
        title: "Countries",
    },
    {
        element: () => <CountriesWithHeadersStickyExample />,
        group: "Data & Layout",
        path: "countries-with-headers-sticky",
        tags: ["Grouped", "Sticky"],
        title: "Countries With Headers Sticky",
    },
    {
        element: () => <ExtraDataExample />,
        group: "Data & Layout",
        path: "extra-data",
        tags: ["State"],
        title: "Extra Data",
    },
    {
        element: () => <FixedSizeItemsExample />,
        group: "Scroll & Position",
        path: "fixed-size-items",
        tags: ["Fixed Size"],
        title: "Fixed Size Items",
    },
    {
        element: () => <InitialScrollIndexExample />,
        group: "Scroll & Position",
        path: "initial-scroll-index",
        tags: ["Initial Scroll"],
        title: "Initial Scroll Index",
    },
    {
        element: () => <LazyListExample />,
        group: "Scroll & Position",
        path: "lazy-list",
        tags: ["Lazy"],
        title: "Lazy List",
    },
    {
        element: () => <MutableCellsExample />,
        group: "Data & Layout",
        path: "mutable-cells",
        tags: ["State"],
        title: "Mutable Cells",
    },
    {
        element: () => <MVCPTestExample />,
        group: "Scroll & Position",
        path: "mvcp-test",
        tags: ["MVCP"],
        title: "MVCP Test",
    },
    {
        element: () => <PrependLargeItemsJumpExample />,
        group: "Scroll & Position",
        path: "prepend-large-items-jump",
        tags: ["Prepend", "MVCP"],
        title: "Prepend Large Items Jump",
    },
    {
        element: () => <VirtualListComparison />,
        group: "Comparisons",
        path: "virtual-list-comparison",
        tags: ["Comparison"],
        title: "Virtual List Comparison",
    },
    {
        element: () => <WindowScrollExample />,
        group: "Comparisons",
        path: "window-scroll",
        tags: ["Window Scroll"],
        title: "Window Scroll",
        usesWindowScroll: true,
    },
    {
        element: () => <ChatExample />,
        group: "Chat & Messaging",
        path: "chat-example",
        tags: ["Chat"],
        title: "Chat Example",
    },
];

export const FIXTURE_GROUPS = Array.from(new Set(FIXTURE_ROUTES.map((route) => route.group)));
