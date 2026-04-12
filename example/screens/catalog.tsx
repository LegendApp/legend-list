import { CatalogScreen } from "~/components/CatalogScreen";
import { getAppMode } from "~/lib/appMode";
import type { CatalogGroup } from "~/lib/catalogTypes";
import { FIXTURE_CATALOG } from "~/lib/fixtureCatalog";
import { CURATED_EXAMPLES, CURATED_GROUP_ORDER } from "../../examples-shared/catalog";

const EXAMPLE_CATALOG: CatalogGroup[] = CURATED_GROUP_ORDER.map((group) => ({
    entries: CURATED_EXAMPLES.filter((example) => example.group === group).map((example) => ({
        description: example.description,
        href: `/${example.slug}`,
        title: example.title,
    })),
    key: group.toLowerCase(),
    title: group,
}));

export function ExamplesHome() {
    return <CatalogScreen groups={EXAMPLE_CATALOG} />;
}

export function FixturesHome() {
    return (
        <CatalogScreen
            groups={FIXTURE_CATALOG}
            subtitle="Debug, regression, and comparison surfaces grouped by behavior area."
            title="Legend List Fixtures"
        />
    );
}

export function ModeHome() {
    return getAppMode() === "fixtures" ? <FixturesHome /> : <ExamplesHome />;
}
