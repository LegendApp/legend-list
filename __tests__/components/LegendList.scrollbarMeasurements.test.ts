import { expect, it } from "bun:test";

it("keeps the mounted list aligned during scrollbar jumps interleaved with native measurements", () => {
    const result = Bun.spawnSync(["bun", "test", "./__tests__/components/LegendList.scrollbarMeasurements.cases.tsx"], {
        cwd: process.cwd(),
        stderr: "pipe",
        stdout: "pipe",
    });
    expect(result.exitCode, result.stdout.toString() + result.stderr.toString()).toBe(0);
});
