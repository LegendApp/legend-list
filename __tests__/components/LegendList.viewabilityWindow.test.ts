import { expect, it } from "bun:test";

it("passes mounted window-scroll viewability regressions in an isolated process", () => {
    const proc = Bun.spawnSync(["bun", "test", "./__tests__/components/LegendList.viewabilityWindow.cases.tsx"], {
        cwd: process.cwd(),
        stderr: "pipe",
        stdout: "pipe",
    });
    expect({ code: proc.exitCode, stderr: proc.stderr.toString() }).toEqual({
        code: 0,
        stderr: expect.any(String),
    });
});
