import { expect, it } from "bun:test";

it("delivers initial visibility to every sibling subscriber", () => {
    const result = Bun.spawnSync(
        ["bun", "test", "./__tests__/components/LegendList.viewabilitySubscriptions.cases.tsx"],
        {
            cwd: process.cwd(),
            stderr: "pipe",
            stdout: "pipe",
        },
    );
    expect(result.exitCode, result.stdout.toString() + result.stderr.toString()).toBe(0);
});
