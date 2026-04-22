import { CatalogScreen } from "~/components/CatalogScreen";
import { getAppMode } from "~/lib/appMode";
import { EXAMPLE_CATALOG, FIXTURE_CATALOG } from "~/screens/routes";

export function ExamplesHome() {
    return <CatalogScreen groups={EXAMPLE_CATALOG} />;
}

export function FixturesHome() {
    return <CatalogScreen groups={FIXTURE_CATALOG} />;
}

export function ModeHome() {
    return getAppMode() === "fixtures" ? <FixturesHome /> : <ExamplesHome />;
}
