import { describe, expect, it } from "bun:test";

describe("LegendList bootstrap initial scroll old architecture", () => {
    it("passes in a fresh old-architecture test process", () => {
        const proc = Bun.spawnSync(
            ["bun", "test", "./__tests__/components/LegendList.bootstrapInitialScroll.oldarch.cases.tsx"],
            {
                cwd: process.cwd(),
                stderr: "pipe",
                stdout: "pipe",
            },
        );

        expect(proc.exitCode).toBe(0);
    });
});
