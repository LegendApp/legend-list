import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export type LineCoverage = Map<string, Map<number, number>>;

export function hasRuntimeChange(before: string, after: string) {
    const transpiler = new Bun.Transpiler({ loader: "tsx" });
    return transpiler.transformSync(before) !== transpiler.transformSync(after);
}

// Bun's fresh-process platform tests and query-suffixed module instances must be
// combined by source path. Coverage is a union: one executed copy covers a line.
export function mergeLcov(target: LineCoverage, text: string, root: string, executable?: Map<string, Set<number>>) {
    for (const record of text.split("end_of_record")) {
        const source = /^SF:(.+)$/m.exec(record)?.[1];
        if (!source) continue;
        const file = relative(root, resolve(root, source.split("?")[0]));
        const lines = target.get(file) ?? new Map<number, number>();
        const recorded = new Set<number>();
        for (const match of record.matchAll(/^DA:(\d+),(\d+)/gm)) {
            const line = Number(match[1]);
            recorded.add(line);
            lines.set(line, Math.max(lines.get(line) ?? 0, Number(match[2])));
        }
        // Bun reports entire uncalled function ranges (including erased types and
        // blank lines) as zeroes. Once called, its record omits non-executable lines.
        // Intersect line maps to remove those phantom zeroes; retain every positive
        // hit separately. Keep the raw union in the report so this is auditable.
        if (executable && recorded.size) {
            const previous = executable.get(file);
            executable.set(file, previous ? new Set([...previous].filter((line) => recorded.has(line))) : recorded);
        }
        target.set(file, lines);
    }
}

export function parseChangedLines(diff: string) {
    const files = new Map<string, Set<number>>();
    let file: string | undefined;
    for (const line of diff.split("\n")) {
        if (line.startsWith("+++ ")) {
            file = line.startsWith("+++ b/") ? line.slice(6) : undefined;
            if (file) files.set(file, new Set());
        } else if (file && line.startsWith("@@ ")) {
            const match = /\+(\d+)(?:,(\d+))?/.exec(line)!;
            const start = Number(match[1]);
            const count = match[2] === undefined ? 1 : Number(match[2]);
            for (let index = start; index < start + count; index++) files.get(file)!.add(index);
        }
    }
    return files;
}

function runCoverage() {
    const root = resolve(import.meta.dir, "..");
    const output = join(root, "coverage", "branch");
    mkdirSync(output, { recursive: true });
    const run = (cmd: string[]) => {
        const result = Bun.spawnSync(cmd, { cwd: root, stderr: "pipe", stdout: "pipe" });
        const text = result.stdout.toString() + result.stderr.toString();
        if (result.exitCode !== 0) throw new Error(`${cmd.join(" ")}\n${text}`);
        return text;
    };
    const base = run(["git", "merge-base", process.argv[2] ?? "main", "HEAD"]).trim();
    const coverage: LineCoverage = new Map();
    const executableLines = new Map<string, Set<number>>();
    let runCount = 0;
    const collect = (args: string[]) => {
        const directory = join(output, `run-${runCount++}`);
        const log = run([
            "bun",
            "test",
            ...args,
            "--coverage",
            "--coverage-reporter=lcov",
            `--coverage-dir=${directory}`,
        ]);
        writeFileSync(`${directory}.log`, log);
        mergeLcov(coverage, readFileSync(join(directory, "lcov.info"), "utf8"), root, executableLines);
        return log;
    };
    console.log("Collecting full-suite coverage...");
    collect([]);
    for (const file of [
        "__tests__/hooks/useContainerMeasurement.legacy.cases.ts",
        "__tests__/hooks/useContainerMeasurement.web.cases.ts",
        "__tests__/hooks/createResizeObserver.web.cases.ts",
        "__tests__/utils/requestAdjust.oldarch.cases.ts",
        "__tests__/core/measureContainersInLayoutEffect.native.test.ts",
    ])
        collect([`./${file}`]);

    // These suites deliberately import a fresh LegendList module per scenario.
    // Isolate each passing test so one module instance cannot overwrite another's
    // counters in Bun's single-file coverage output. Assertions still run normally.
    for (const file of [
        "__tests__/components/LegendList.props.test.tsx",
        "__tests__/components/LegendList.bootstrapInitialScroll.test.tsx",
        "__tests__/components/LegendList.bootstrapInitialScroll.oldarch.cases.tsx",
        "__tests__/components/LegendList.measurementOwnership.cases.tsx",
        "__tests__/components/LegendList.scrollbarMeasurements.cases.tsx",
        "__tests__/components/LegendList.viewabilitySubscriptions.cases.tsx",
        "__tests__/components/LegendList.viewabilityInteraction.cases.tsx",
        "__tests__/components/LegendList.viewabilityTiming.cases.tsx",
    ]) {
        const suiteLog = collect([`./${file}`]);
        const names = [...suiteLog.matchAll(/^\(pass\) (.+?)(?: \[[\d.]+(?:ms|s)\])?$/gm)].map(
            (match) => match[1].split(" > ").at(-1)!,
        );
        console.log(`Collecting ${names.length} isolated scenarios from ${file}...`);
        for (const name of names) {
            const pattern = `${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
            const log = collect([`./${file}`, "--test-name-pattern", pattern]);
            if (!/\b[1-9]\d* pass\b/.test(log)) throw new Error(`Coverage scenario did not execute: ${name}`);
        }
    }
    const diff = run(["git", "diff", "--unified=0", base, "--", "src"]);
    const changed = parseChangedLines(diff);
    for (const file of run(["git", "ls-files", "--others", "--exclude-standard", "src"])
        .trim()
        .split("\n")
        .filter(Boolean)) {
        changed.set(
            file,
            new Set(
                readFileSync(join(root, file), "utf8")
                    .split("\n")
                    .map((_, index) => index + 1),
            ),
        );
    }
    const rows = [...changed].map(([file, changedLines]) => {
        const lines = coverage.get(file);
        const raw = [...changedLines].filter((line) => lines?.has(line));
        const executable = raw.filter((line) => lines!.get(line) || executableLines.get(file)?.has(line));
        const uncovered = executable.filter((line) => !lines!.get(line));
        let missingRuntimeCoverage = false;
        if (!lines) {
            const before = Bun.spawnSync(["git", "show", `${base}:${file}`], { cwd: root }).stdout.toString();
            missingRuntimeCoverage = hasRuntimeChange(before, readFileSync(join(root, file), "utf8"));
        }
        return {
            changed: executable.length,
            covered: executable.length - uncovered.length,
            file,
            measured: !!lines,
            missingRuntimeCoverage,
            rawReported: raw.length,
            uncovered,
        };
    });
    const total = rows.reduce((sum, row) => sum + row.changed, 0);
    const covered = rows.reduce((sum, row) => sum + row.covered, 0);
    const percent = total > 0 ? (100 * covered) / total : undefined;
    const report = {
        base,
        covered,
        files: rows,
        head: run(["git", "rev-parse", "HEAD"]).trim(),
        includesWorkingTree: true,
        percent,
        rawReported: rows.reduce((sum, row) => sum + row.rawReported, 0),
        runs: runCount,
        total,
    };
    writeFileSync(join(output, "summary.json"), `${JSON.stringify(report, null, 4)}\n`);
    const table = rows
        .map(
            (row) =>
                `| ${row.file} | ${row.changed ? `${row.covered}/${row.changed}` : "No measured executable additions"} | ${row.uncovered.join(", ") || "—"} |`,
        )
        .join("\n");
    writeFileSync(
        join(output, "summary.md"),
        `# Branch coverage\n\nBase: ${base}. Includes working-tree changes.\n\n${covered}/${total} changed executable lines covered (${percent?.toFixed(2) ?? "n/a"}%). Bun-normalized line coverage, not condition/branch coverage. Raw union: ${covered}/${report.rawReported}; uncalled source ranges include erased types and blank lines. See docs/sparse-layout-testing.md for the normalization method.\n\n| File | Covered/changed | Uncovered lines |\n| --- | --- | --- |\n${table}\n\nType-only additions need the public type tests. Unmeasured runtime changes: ${
            rows
                .filter((row) => row.missingRuntimeCoverage)
                .map((row) => row.file)
                .join(", ") || "none"
        }. Regression cases run in the default suite and isolated mounted scenarios contribute coverage.\n`,
    );
    console.log(
        `Changed executable lines: ${covered}/${total} (${percent?.toFixed(2) ?? "n/a"}%). Report: ${output}/summary.md`,
    );
    // Do not substitute a repository-wide percentage for the branch's added code.
    if ((percent !== undefined && percent < 95) || rows.some((row) => row.missingRuntimeCoverage)) process.exitCode = 1;
}

if (import.meta.main) runCoverage();
