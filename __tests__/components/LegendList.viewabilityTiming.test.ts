import { expect, it } from "bun:test";

it("waits for each row to satisfy minimum visibility time", () => {
    const result = Bun.spawnSync(["bun", "test", "./__tests__/components/LegendList.viewabilityTiming.cases.tsx"], {
        cwd: process.cwd(),
        stderr: "pipe",
        stdout: "pipe",
    });
    expect(result.exitCode, result.stdout.toString() + result.stderr.toString()).toBe(0);
});
