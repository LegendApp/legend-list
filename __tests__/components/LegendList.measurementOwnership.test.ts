import { expect, it } from "bun:test";

it("preserves measurement ownership and public layout behavior", () => {
    const result = Bun.spawnSync(["bun", "test", "./__tests__/components/LegendList.measurementOwnership.cases.tsx"], {
        cwd: process.cwd(),
        stderr: "pipe",
        stdout: "pipe",
    });
    expect(result.exitCode, result.stdout.toString() + result.stderr.toString()).toBe(0);
});
