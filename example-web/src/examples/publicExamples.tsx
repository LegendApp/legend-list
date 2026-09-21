import { ItemSeparatorsExample } from "./ItemSeparatorsExample";
import LibraryBenchmarkExample from "./LibraryBenchmarkExample";
import type { PublicExampleSlug } from "./publicExampleRoutes";

export function renderPublicExample(slug: PublicExampleSlug) {
    switch (slug) {
        case "item-separators":
            return <ItemSeparatorsExample />;
        case "library-benchmark":
            return <LibraryBenchmarkExample />;
        default:
            return null;
    }
}
