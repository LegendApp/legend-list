import { describe, expect, it } from "bun:test";

describe("requestAdjust old architecture", () => {
    it("passes in a fresh old-architecture test process", () => {
        const proc = Bun.spawnSync(["bun", "test", "./__tests__/utils/requestAdjust.oldarch.cases.ts"], {
            cwd: process.cwd(),
            stderr: "pipe",
            stdout: "pipe",
        });

        expect(proc.exitCode).toBe(0);
    });
});
