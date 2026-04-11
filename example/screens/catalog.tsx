import { CURATED_EXAMPLES, CURATED_GROUP_ORDER } from "@examples/catalog";

import { CatalogScreen } from "~/components/CatalogScreen";
import { getAppMode } from "~/lib/appMode";
import type { CatalogGroup } from "~/lib/catalogTypes";
import { FIXTURE_CATALOG } from "~/lib/fixtureCatalog";

const EXAMPLE_CATALOG: CatalogGroup[] = CURATED_GROUP_ORDER.map((group) => ({
    entries: CURATED_EXAMPLES.filter((example) => example.group === group).map((example) => ({
        href: `/${example.slug}`,
        tags: example.tags,
        title: example.title,
    })),
    key: group.toLowerCase(),
    title: group,
}));

export function ExamplesHome() {
    return (
        <CatalogScreen
            groups={EXAMPLE_CATALOG}
            subtitle="Twelve curated product-style demos that share the same core behaviors across native and web."
            title="Legend List Examples"
        />
    );
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
