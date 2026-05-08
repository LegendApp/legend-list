import LibraryBenchmarkExample from "./LibraryBenchmarkExample";
import type { PublicExampleSlug } from "./publicExampleRoutes";

export function renderPublicExample(slug: PublicExampleSlug) {
    switch (slug) {
        case "library-benchmark":
            return <LibraryBenchmarkExample />;
        default:
            return null;
    }
}
