import { isFixturesMode } from "~/lib/appMode";
import ProductShelfExampleScreen from "~/screens/examples/product-shelf";
import ProductShelfFixtureScreen from "~/screens/fixtures/product-shelf";

export default function ProductShelfRoute() {
    return isFixturesMode() ? <ProductShelfFixtureScreen /> : <ProductShelfExampleScreen />;
}
