import type { PublicExampleSlug } from "./publicExampleRoutes";
import VirtualListComparison from "./VirtualListComparison";

export function renderPublicExample(slug: PublicExampleSlug) {
    switch (slug) {
        case "library-benchmark":
            return <VirtualListComparison />;
        default:
            return null;
    }
}
