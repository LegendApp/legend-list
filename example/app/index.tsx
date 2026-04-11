import { Stack } from "expo-router";
import { EXAMPLE_CATALOG } from "~/catalogs/examples";
import { FIXTURE_CATALOG } from "~/catalogs/fixtures";
import { CatalogScreen } from "~/components/catalog/CatalogScreen";
import { getAppMode } from "~/lib/appMode";

export default function HomeScreen() {
    const mode = getAppMode();
    const groups =
        mode === "fixtures"
            ? FIXTURE_CATALOG
            : [
                  {
                      entries: EXAMPLE_CATALOG.filter((entry) => entry.group === "Messaging"),
                      title: "Messaging",
                  },
                  {
                      entries: EXAMPLE_CATALOG.filter((entry) => entry.group === "Directory"),
                      title: "Directory",
                  },
                  {
                      entries: EXAMPLE_CATALOG.filter((entry) => entry.group === "Commerce"),
                      title: "Commerce",
                  },
                  {
                      entries: EXAMPLE_CATALOG.filter((entry) => entry.group === "Media"),
                      title: "Media",
                  },
              ];

    return (
        <>
            <Stack.Screen options={{ headerTitle: mode === "fixtures" ? "Fixtures" : "Examples", headerTransparent: false }} />
            <CatalogScreen groups={groups} modeLabel={mode} title={mode === "fixtures" ? "Legend List Fixtures" : "Legend List Examples"} />
        </>
    );
}
