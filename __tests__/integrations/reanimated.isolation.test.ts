import { expect, it } from "bun:test";

// These seeds exercise both file orders in a fresh module registry. The item-layout
// suite used to establish an incomplete Reanimated export shape for keyboard-legacy.
for (const seed of [1, 3]) {
    it(`loads item-layout and keyboard integrations in either order (seed: ${seed})`, () => {
        const result = Bun.spawnSync(
            [
                process.execPath,
                "test",
                "./__tests__/integrations/reanimated.itemLayoutAnimation.test.tsx",
                "./__tests__/integrations/keyboard.interactive-state.test.tsx",
                "--randomize",
                `--seed=${seed}`,
            ],
            { cwd: process.cwd(), stderr: "pipe", stdout: "pipe" },
        );
        expect(result.exitCode, new TextDecoder().decode(result.stderr)).toBe(0);
    });
}
