import { expect, it } from "bun:test";

it("keeps chat fixture identities valid through repeated interactions", () => {
    // The web example uses React 18; isolate its React 19 test-renderer override.
    const result = Bun.spawnSync([process.execPath, "test", "./__tests__/components/ChatEndFollow.fixture.cases.tsx"], {
        cwd: process.cwd(),
        stderr: "pipe",
        stdout: "pipe",
    });
    if (result.exitCode !== 0) {
        throw new Error(new TextDecoder().decode(result.stderr));
    }
    expect(result.exitCode).toBe(0);
});
