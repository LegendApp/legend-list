import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface EngineResult {
    gcStats?: unknown;
    name: "hermes" | "v8";
    profile: unknown;
}

const root = join(import.meta.dir, "..");
const bundlePath = join(tmpdir(), `legend-list-engine-profile-${process.pid}.js`);
const hermesPath = join(root, "node_modules/react-native/sdks/hermesc/osx-bin/hermes");

try {
    run([
        "bunx",
        "esbuild",
        "benchmarks/engine-profile-entry.ts",
        "--bundle",
        "--format=iife",
        "--platform=neutral",
        "--target=es2018",
        `--outfile=${bundlePath}`,
    ]);
    const { transformSync } = await import("@babel/core");
    const bundledSource = await Bun.file(bundlePath).text();
    const hermesCompatibleSource = transformSync(bundledSource, {
        compact: true,
        plugins: ["@babel/plugin-transform-classes"],
    })?.code;
    if (!hermesCompatibleSource) {
        throw new Error("Babel did not produce a Hermes-compatible benchmark bundle");
    }
    await Bun.write(bundlePath, hermesCompatibleSource);
    const results: EngineResult[] = [
        runEngine("v8", ["node", "--expose-gc", bundlePath]),
        runEngine("hermes", [hermesPath, "-O", "-gc-before-stats", "-gc-print-stats", bundlePath]),
    ];
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), results, version: 1 }, undefined, 2));
} finally {
    rmSync(bundlePath, { force: true });
}

function run(command: string[]) {
    const result = Bun.spawnSync({ cmd: command, cwd: root, stderr: "pipe", stdout: "pipe" });
    if (result.exitCode !== 0) {
        throw new Error(`${command[0]} failed:\n${result.stderr.toString()}\n${result.stdout.toString()}`);
    }
    return result;
}

function runEngine(name: EngineResult["name"], command: string[]): EngineResult {
    const result = run(command);
    const stdout = result.stdout.toString();
    const marker = stdout.split("\n").find((line) => line.startsWith("LEGEND_PROFILE_JSON="));
    if (!marker) {
        throw new Error(`${name} did not emit a profile payload:\n${stdout}`);
    }
    const gcStats = name === "hermes" ? parseHermesGcStats(result.stderr.toString()) : undefined;
    return {
        gcStats: gcStats || undefined,
        name,
        profile: JSON.parse(marker.slice("LEGEND_PROFILE_JSON=".length)),
    };
}

function parseHermesGcStats(stderr: string) {
    const marker = "GC stats:\n";
    const start = stderr.indexOf(marker);
    let summary: unknown;
    if (start >= 0) {
        const stats = JSON.parse(stderr.slice(start + marker.length));
        summary = { general: stats.general, heapInfo: stats.heapInfo };
    }
    return summary;
}
