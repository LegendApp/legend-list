import { describe, expect, it } from "bun:test";
import { shouldHideContainersUntilReady } from "../../src/components/shouldHideContainersUntilReady";

describe("Containers visibility", () => {
    it("hides while readyToRender is unset", () => {
        expect(shouldHideContainersUntilReady(undefined)).toBe(true);
        expect(shouldHideContainersUntilReady(false)).toBe(true);
    });

    it("shows once readyToRender is true", () => {
        expect(shouldHideContainersUntilReady(true)).toBe(false);
    });
});
