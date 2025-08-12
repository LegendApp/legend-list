import React from "react";

import { createRootRoute, createRoute, createRouter, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import AccurateScrollToExample from "./examples/AccurateScrollToExample";
import AccurateScrollToHugeExample from "./examples/AccurateScrollToHugeExample";
import AddToEndExample from "./examples/AddToEndExample";
import BidirectionalInfiniteListExample from "./examples/BidirectionalInfiniteListExample";
import ColumnsExample from "./examples/ColumnsExample";
import CountriesExample from "./examples/CountriesExample";
import CountriesWithHeadersStickyExample from "./examples/CountriesWithHeadersStickyExample";
import ExtraDataExample from "./examples/ExtraDataExample";
import InitialScrollIndexExample from "./examples/InitialScrollIndexExample";
import LazyListExample from "./examples/LazyListExample";
import MutableCellsExample from "./examples/MutableCellsExample";
import MVCPTestExample from "./examples/MVCPTestExample";
import VirtualListComparison from "./VirtualListComparison";

export type ExampleRoute = {
    path: string;
    title: string;
    element: () => React.ReactNode;
};

export const EXAMPLES: ExampleRoute[] = [
    {
        element: () => <BidirectionalInfiniteListExample />,
        path: "bidirectional-infinite-list",
        title: "Bidirectional Infinite List",
    },
    { element: () => <CountriesExample />, path: "countries", title: "Countries List" },
    {
        element: () => <CountriesWithHeadersStickyExample />,
        path: "countries-with-headers-sticky",
        title: "Countries with headers sticky",
    },
    { element: () => <LazyListExample />, path: "lazy-list", title: "Lazy List" },
    { element: () => <MVCPTestExample />, path: "mvcp-test", title: "MVCP test" },
    { element: () => <ColumnsExample />, path: "columns", title: "Columns" },
    { element: () => <InitialScrollIndexExample />, path: "initial-scroll-index", title: "Initial scroll index" },
    { element: () => <AccurateScrollToExample />, path: "accurate-scrollto", title: "Accurate scrollTo" },
    { element: () => <AddToEndExample />, path: "add-to-end", title: "Add to the end" },
    { element: () => <MutableCellsExample />, path: "mutable-cells", title: "Mutable cells" },
    { element: () => <ExtraDataExample />, path: "extra-data", title: "Extra data" },
    { element: () => <AccurateScrollToHugeExample />, path: "accurate-scrollto-huge", title: "Accurate scrollTo huge" },
    { element: () => <VirtualListComparison />, path: "virtual-list-comparison", title: "Virtual List Comparison" },
];

function SidebarLayout() {
    const router = useRouter();
    const pathname = useRouterState({ select: (s) => s.location.pathname });

    return (
        <div>
            <h1>Legend List Web Example</h1>
            <div style={{ marginBottom: 16 }} />
            <div style={{ alignItems: "stretch", display: "flex", gap: 16 }}>
                <div
                    style={{
                        borderRight: "1px solid #eee",
                        flex: "0 0 260px",
                        paddingRight: 12,
                        width: 260,
                    }}
                >
                    <h2 style={{ marginTop: 0 }}>Legend List Web Examples</h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {EXAMPLES.map((ex) => {
                            const href = `/${ex.path}`;
                            const isActive = pathname === href;
                            return (
                                <a
                                    href={href}
                                    key={ex.path}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        router.navigate({ to: href as any });
                                    }}
                                    style={{
                                        background: isActive ? "#eef6ff" : "#fff",
                                        border: isActive ? "1px solid #8ab4f8" : "1px solid #ddd",
                                        borderRadius: 6,
                                        cursor: "pointer",
                                        padding: "8px 10px",
                                        textDecoration: "none",
                                    }}
                                >
                                    {ex.title}
                                </a>
                            );
                        })}
                    </div>
                </div>
                <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 12, minWidth: 0 }}>
                    <Outlet />
                </div>
            </div>
        </div>
    );
}

const rootRoute = createRootRoute({
    component: SidebarLayout,
});

const routes = EXAMPLES.map((ex) =>
    createRoute({
        component: () => (
            <div style={{ display: "flex", flexDirection: "column" }}>
                <h3 style={{ margin: 0 }}>{ex.title}</h3>
                <div>{ex.element()}</div>
            </div>
        ),
        getParentRoute: () => rootRoute,
        path: ex.path,
    }),
);

function IndexRedirect() {
    const router = useRouter();
    React.useEffect(() => {
        router.navigate({ to: `/${EXAMPLES[0].path}` as any });
    }, [router]);
    return null;
}

const indexRoute = createRoute({
    component: IndexRedirect,
    getParentRoute: () => rootRoute,
    path: "/",
});

const routeTree = rootRoute.addChildren([...routes, indexRoute]);

export const router = createRouter({
    routeTree,
});

// Register the Router instance type for TS auto types
declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}
