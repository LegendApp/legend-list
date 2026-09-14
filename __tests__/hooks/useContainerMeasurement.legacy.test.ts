import { expect, it } from "bun:test";

it("passes legacy measurement regressions in a fresh process", () => {
    const proc = Bun.spawnSync(["bun", "test", "./__tests__/hooks/useContainerMeasurement.legacy.cases.ts"], {
        cwd: process.cwd(),
        stderr: "pipe",
        stdout: "pipe",
    });
    expect(proc.exitCode).toBe(0);
});
