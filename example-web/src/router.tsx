import { CURATED_EXAMPLES } from "@examples/catalog";
import { createRootRoute, createRoute, createRouter, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { getAppMode } from "./appMode";
import { CatalogHome } from "./catalog/CatalogHome";
import { SidebarShell } from "./catalog/SidebarShell";
import { EXAMPLE_SECTIONS, FIXTURE_SECTIONS } from "./catalogMeta";
import { renderCuratedExample } from "./examples/curated";
import { FIXTURE_ROUTES } from "./fixtures/routes";

const appMode = getAppMode();

function RootLayout() {
    const router = useRouter();
    const pathname = useRouterState({ select: (state) => state.location.pathname });
    const isHome = pathname === "/";
    const isWindowScrollExample = appMode === "examples" && pathname === "/cards-feed";

    if (isHome) {
        return <Outlet />;
    }

    const sections = appMode === "fixtures" ? FIXTURE_SECTIONS : EXAMPLE_SECTIONS;
    const activeSlug = pathname.slice(1);

    return (
        <SidebarShell
            activeSlug={activeSlug}
            heading={appMode === "fixtures" ? "Legend List Fixtures" : "Legend List Examples"}
            onGoHome={() => router.navigate({ to: "/" })}
            onOpen={(slug) => router.navigate({ to: `/${slug}` as any })}
            sections={sections}
            windowScroll={isWindowScrollExample}
        >
            <Outlet />
        </SidebarShell>
    );
}

const rootRoute = createRootRoute({
    component: RootLayout,
});

function HomePage() {
    const router = useRouter();
    const sections = appMode === "fixtures" ? FIXTURE_SECTIONS : EXAMPLE_SECTIONS;

    return (
        <CatalogHome
            heading={appMode === "fixtures" ? "Legend List Fixtures" : "Legend List Examples"}
            onOpen={(slug) => router.navigate({ to: `/${slug}` as any })}
            sections={sections}
            subheading={
                appMode === "fixtures"
                    ? "Internal validation surfaces grouped by behavior area."
                    : "Curated product-style examples that share the same core behaviors across native and web."
            }
        />
    );
}

const indexRoute = createRoute({
    component: HomePage,
    getParentRoute: () => rootRoute,
    path: "/",
});

const exampleRoutes = CURATED_EXAMPLES.map((example) =>
    createRoute({
        component: () => (
            <div className={example.slug === "cards-feed" ? "flex flex-col" : "flex min-h-0 flex-1 flex-col"}>
                {renderCuratedExample(example.slug)}
            </div>
        ),
        getParentRoute: () => rootRoute,
        path: example.slug,
    }),
);

const fixtureRoutes = FIXTURE_ROUTES.map((fixture) =>
    createRoute({
        component: () => (
            <div className={fixture.usesWindowScroll ? "flex flex-col" : "flex min-h-0 flex-1 flex-col"}>
                {fixture.element()}
            </div>
        ),
        getParentRoute: () => rootRoute,
        path: fixture.path,
    }),
);

const routeTree = rootRoute.addChildren([indexRoute, ...(appMode === "fixtures" ? fixtureRoutes : exampleRoutes)]);

export const router = createRouter({
    routeTree,
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}
