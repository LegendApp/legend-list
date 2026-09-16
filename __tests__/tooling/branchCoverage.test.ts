import { expect, it } from "bun:test";
import { hasRuntimeChange, type LineCoverage, mergeLcov, parseChangedLines } from "../../scripts/branch-coverage";

it("requires coverage for new runtime code while recognizing erased type changes", () => {
    expect(hasRuntimeChange("", "export const size = 50;")).toBe(true);
    expect(hasRuntimeChange("export const size = 50;", "export const size = 100;")).toBe(true);
    expect(hasRuntimeChange("", "export interface Size { value: number }")).toBe(false);
    expect(
        hasRuntimeChange(
            'export const os = "web" as "web" | "ios";',
            'export const os = "web" as "web" | "ios" | "macos";',
        ),
    ).toBe(false);
});

it("unions source coverage across module queries, absolute paths, and child runs", () => {
    const lines: LineCoverage = new Map();
    mergeLcov(lines, "SF:src/list.ts?mount\nDA:10,2\nDA:11,0\nend_of_record", "/repo");
    mergeLcov(lines, "SF:/repo/src/list.ts?replace\nDA:10,0\nDA:11,3\nDA:12,0\nend_of_record", "/repo");
    expect([...lines]).toEqual([
        [
            "src/list.ts",
            new Map([
                [10, 2],
                [11, 3],
                [12, 0],
            ]),
        ],
    ]);
});

it("counts new-side lines without counting deleted-only hunks or deleted files", () => {
    const diff =
        "+++ b/src/a.ts\n@@ -2 +2,2 @@\n+x\n+y\n@@ -8,2 +9,0 @@\n-old\n+++ /dev/null\n@@ -1,2 +0,0 @@\n+++ b/src/new.ts\n@@ -0,0 +1 @@\n+x";
    expect([...parseChangedLines(diff)]).toEqual([
        ["src/a.ts", new Set([2, 3])],
        ["src/new.ts", new Set([1])],
    ]);
});

it("distinguishes Bun's uncalled source ranges from executable lines without losing hits", () => {
    const hits: LineCoverage = new Map();
    const executable = new Map<string, Set<number>>();
    mergeLcov(hits, "SF:src/a.ts\nDA:1,0\nDA:2,0\nDA:3,0\nDA:4,1\nend_of_record", "/repo", executable);
    mergeLcov(hits, "SF:src/a.ts\nDA:2,1\nDA:3,0\nend_of_record", "/repo", executable);
    // Line 1 was an erased type; 3 is still an uncovered statement. A positive
    // counter on 4 remains covered even when another record does not contain it.
    expect([...executable.get("src/a.ts")!]).toEqual([2, 3]);
    expect([...hits.get("src/a.ts")!]).toEqual([
        [1, 0],
        [2, 1],
        [3, 0],
        [4, 1],
    ]);
});
