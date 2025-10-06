import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const SRC_DIR = path.resolve(process.cwd(), "src");
const TARGET_LINE = 'import * as React from "react";';

async function collectTSXFiles(): Promise<string[]> {
    const entries = await readdir(SRC_DIR, { recursive: true });

    return entries
        .filter((entry) => entry.endsWith(".tsx"))
        .map((entry) => path.join(SRC_DIR, entry));
}

async function run() {
    const files = await collectTSXFiles();
    const missing: string[] = [];

    for (const file of files) {
        const contents = await readFile(file, "utf8");
        const hasTargetLine = contents.split(/\r?\n/).some((line) => line.trim() === TARGET_LINE);

        if (!hasTargetLine) {
            missing.push(path.relative(process.cwd(), file));
        }
    }

    if (missing.length > 0) {
        console.error("Missing React import in the following files:");
        for (const file of missing) {
            console.error(` - ${file}`);
        }
        process.exitCode = 1;
        return;
    }

    console.log(`Verified React import in ${files.length} .tsx files.`);
}

run().catch((error) => {
    console.error("Failed to run prebuild check:", error);
    process.exitCode = 1;
});
