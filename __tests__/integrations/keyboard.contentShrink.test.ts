import { expect, it } from "bun:test";

for (const model of ["contentShrink", "commitOrder", "nativeOrder", "rangeFloor"]) {
    it(`passes the mounted keyboard ${model} cases`, () => {
        const result = Bun.spawnSync(["bun", "test", `./__tests__/integrations/keyboard.${model}.cases.tsx`], {
            stderr: "pipe",
            stdout: "pipe",
        });
        expect({
            exitCode: result.exitCode,
            output: result.exitCode === 0 ? "" : result.stdout.toString() + result.stderr.toString(),
        }).toEqual({ exitCode: 0, output: "" });
    });
}
