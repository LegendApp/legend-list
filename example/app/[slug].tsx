import { Stack, useLocalSearchParams } from "expo-router";

import { getRouteBySlug } from "~/screens/routes";
import NotFoundScreen from "./+not-found";

export default function SlugRoute() {
    const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
    const routeSlug = Array.isArray(slug) ? slug[0] : slug;
    const route = routeSlug ? getRouteBySlug(routeSlug) : undefined;

    if (!route) {
        return <NotFoundScreen />;
    }

    const ScreenComponent = route.component;

    return (
        <>
            <Stack.Screen options={{ headerTitle: route.title, headerTransparent: false }} />
            <ScreenComponent />
        </>
    );
}
