// Run with Bun; see README.md. Build before acquiring a shared measurement lock.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [command, baseline, candidate, output] = process.argv.slice(2);
const reactModules = process.env.REACT_MODULES;
if (!output || !reactModules || !["build", "measure"].includes(command)) {
    throw new Error(
        "Usage: REACT_MODULES=<node_modules> bun mount.ts build|measure <baseline-tree> <candidate-tree> <output>",
    );
}
const arms = { baseline: path.resolve(baseline), candidate: path.resolve(candidate) };
if (command === "build") {
    for (const [arm, tree] of Object.entries(arms)) {
        const outdir = path.resolve(output, arm);
        mkdirSync(outdir, { recursive: true });
        const result = await Bun.build({
            define: { __DEV__: "false", global: "globalThis", "process.env.NODE_ENV": '"production"' },
            entrypoints: [path.join(import.meta.dir, "mount.tsx")],
            minify: true,
            outdir,
            plugins: [
                {
                    name: "matched-inputs",
                    setup(build) {
                        build.onResolve({ filter: /^@legendapp\/list\/react$/ }, () => ({
                            path: `${tree}/src/react.ts`,
                        }));
                        build.onResolve({ filter: /^@\// }, ({ path: specifier }) => ({
                            path: Bun.resolveSync(`${tree}/src/${specifier.slice(2)}`, `${tree}/`),
                        }));
                        build.onResolve(
                            { filter: /^(react|react-dom|scheduler|use-sync-external-store)(\/.*)?$/ },
                            (args) => ({
                                path: Bun.resolveSync(args.path, `${reactModules}/`),
                            }),
                        );
                    },
                },
            ],
            target: "browser",
        });
        if (!result.success) throw new Error(result.logs.map(String).join("\n"));
        writeFileSync(`${outdir}/index.html`, '<!doctype html><div id="root"></div><script src="mount.js"></script>');
    }
    writeFileSync(
        path.resolve(output, "inputs.json"),
        JSON.stringify({ arms, bun: Bun.version, mode: "production", reactModules }),
    );
} else {
    const pairs = Number(process.env.PAIRS || 7);
    if (!Number.isInteger(pairs) || pairs < 1) throw new Error("PAIRS must be a positive integer");
    const playwright = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
    const browser = await playwright.chromium.launch({ channel: "chrome", headless: true });
    const results = [];
    try {
        for (let pair = -1; pair < pairs; pair++) {
            for (const sizing of ["fixed", "measured"]) {
                // A same-build control exposes baseline-to-baseline variance.
                const orders = [
                    ["baseline", "candidate", "control"],
                    ["candidate", "control", "baseline"],
                    ["control", "baseline", "candidate"],
                    ["control", "candidate", "baseline"],
                    ["baseline", "control", "candidate"],
                    ["candidate", "baseline", "control"],
                ];
                const order = orders[(pair + orders.length) % orders.length];
                for (const arm of order) {
                    const context = await browser.newContext({
                        deviceScaleFactor: 1,
                        viewport: { height: 900, width: 1400 },
                    });
                    try {
                        const page = await context.newPage();
                        const errors: string[] = [];
                        page.on("pageerror", (error: Error) => errors.push(String(error)));
                        const cdp = await context.newCDPSession(page);
                        await cdp.send("Performance.enable", { timeDomain: "threadTicks" });
                        await page.goto(
                            `${pathToFileURL(path.resolve(output, arm === "control" ? "baseline" : arm, "index.html"))}?sizing=${sizing}`,
                        );
                        await page.waitForFunction(() => "mountBenchmark" in window);
                        await page.waitForTimeout(500);
                        const metrics = async () =>
                            Object.fromEntries(
                                (await cdp.send("Performance.getMetrics")).metrics.map(
                                    ({ name, value }: { name: string; value: number }) => [name, value],
                                ),
                            );
                        const samples = [];
                        // Keep the first mount visible in the evidence, then measure five fresh
                        // list instances in this renderer to reduce process-startup variance.
                        for (let sample = -1; sample < 5; sample++) {
                            await page.evaluate(() => (window as any).resetMountBenchmark());
                            await page.waitForTimeout(100);
                            const before = await metrics();
                            const mount = await page.evaluate(() =>
                                Promise.race([
                                    (window as any).mountBenchmark(),
                                    new Promise((_, reject) =>
                                        setTimeout(() => reject(new Error("Mount readiness timed out")), 15000),
                                    ),
                                ]),
                            );
                            await page.waitForTimeout(800);
                            const after = await metrics();
                            samples.push({
                                sample,
                                ...mount,
                                layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
                                scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
                                taskMs: (after.TaskDuration - before.TaskDuration) * 1000,
                            });
                        }
                        const measured = samples.filter((sample) => sample.sample >= 0);
                        const median = (key: string) => measured.map((sample) => sample[key]).sort((a, b) => a - b)[2];
                        const rows = await page.locator("[data-row]").count();
                        const nodes = await page.locator("#root *").count();
                        if (errors.length || rows < 12) throw new Error(JSON.stringify({ errors, rows }));
                        const entry = {
                            arm,
                            browser: browser.version(),
                            layoutMs: median("layoutMs"),
                            nodes,
                            pair,
                            readyMs: median("readyMs"),
                            rows,
                            samples,
                            scriptMs: median("scriptMs"),
                            sizing,
                            syncMs: median("syncMs"),
                            taskMs: median("taskMs"),
                            timeDomain: "threadTicks",
                        };
                        results.push(entry);
                        console.log(JSON.stringify(entry));
                    } finally {
                        await context.close();
                    }
                }
            }
        }
    } finally {
        await browser.close();
        writeFileSync(path.resolve(output, "results.json"), JSON.stringify(results, null, 2));
    }
    console.log(readFileSync(path.resolve(output, "inputs.json"), "utf8"));
}
