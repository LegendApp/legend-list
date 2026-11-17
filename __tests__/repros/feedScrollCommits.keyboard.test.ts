import { expect, it } from "bun:test";

it("keeps keyboard-aware feed scroll commits at 3.7.2 levels in an isolated process", () => {
    const proc = Bun.spawnSync(["bun", "test", "./__tests__/repros/feedScrollCommits.keyboard.cases.tsx"], {
        cwd: process.cwd(),
        stderr: "pipe",
        stdout: "pipe",
    });
    expect({ code: proc.exitCode, stderr: proc.stderr.toString() }).toEqual({
        code: 0,
        stderr: expect.any(String),
    });
});
