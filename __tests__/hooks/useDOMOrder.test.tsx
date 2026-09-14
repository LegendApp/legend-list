import { expect, it } from "bun:test";

it("passes DOM-order scheduling cases in an isolated process", () => {
    const result = Bun.spawnSync(["bun", "test", "./__tests__/hooks/useDOMOrder.cases.tsx"], {
        cwd: process.cwd(),
        stderr: "pipe",
        stdout: "pipe",
    });
    expect(result.exitCode, new TextDecoder().decode(result.stderr)).toBe(0);
});
