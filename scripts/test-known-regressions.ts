// Focused release regressions also run through the default suite and public type checks.
const checks = [
    ["bun", "test", "./__tests__/components/LegendList.viewabilityInteraction.cases.tsx"],
    ["bun", "test", "./__tests__/components/LegendList.measurementOwnership.cases.tsx"],
    ["bun", "test", "./__tests__/components/LegendList.viewabilitySubscriptions.cases.tsx"],
    ["bun", "test", "./__tests__/components/LegendList.viewabilityTiming.cases.tsx"],
    ["bunx", "tsc", "--noEmit", "--project", "tsconfig.package-types.json"],
];
let failed = false;
for (const cmd of checks) {
    const result = Bun.spawnSync(cmd, { cwd: `${import.meta.dir}/..`, stderr: "inherit", stdout: "inherit" });
    failed ||= result.exitCode !== 0;
}
process.exitCode = failed ? 1 : 0;
