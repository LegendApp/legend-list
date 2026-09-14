import { expect, it } from "bun:test";

it("waits for interaction before publishing configured visibility", () => {
    const result = Bun.spawnSync(
        ["bun", "test", "./__tests__/components/LegendList.viewabilityInteraction.cases.tsx"],
        {
            cwd: process.cwd(),
            stderr: "pipe",
            stdout: "pipe",
        },
    );
    expect(result.exitCode, result.stdout.toString() + result.stderr.toString()).toBe(0);
});
