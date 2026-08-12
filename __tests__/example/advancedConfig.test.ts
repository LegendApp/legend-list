import { ADVANCED_HOME_ENTRIES } from "../../example/screens/examples/advancedConfig";

describe("advanced example config", () => {
    it("keeps every advanced example directly addressable", () => {
        expect(ADVANCED_HOME_ENTRIES.map((entry) => entry.href)).toEqual([
            "/ai-chat-keyboard",
            "/visibility",
            "/reanimated-shared-values",
        ]);
        expect(new Set(ADVANCED_HOME_ENTRIES.map((entry) => entry.id)).size).toBe(ADVANCED_HOME_ENTRIES.length);
    });
});
