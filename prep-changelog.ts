#!/usr/bin/env bun

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));
const currentVersion = packageJson.version;
const changelog = readFileSync("./CHANGELOG.md", "utf-8");

// Check if current version already exists in changelog
const versionHeader = `## ${currentVersion}`;
if (changelog.includes(versionHeader)) {
    console.log(`✅ Version ${currentVersion} already exists in CHANGELOG.md`);
    process.exit(0);
}

console.log(`🔍 Version ${currentVersion} not found in CHANGELOG.md`);
console.log(`📝 Generating changelog entry using Claude CLI...`);

// Run Claude CLI to update changelog
try {
    execSync(
        `/Users/jay/.claude/local/claude -p "update the changelog with the changes in the latest version. See changelog.mdc for more details."`,
        {
            stdio: "inherit",
        },
    );

    console.log("\n✅ Claude CLI execution completed.");

    // Prompt for confirmation
    const readline = require("readline");
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.question("\n❓ Apply this changelog update? (y/N): ", (answer) => {
        if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
            console.log("✅ Changelog approved. Continuing with publish...");
            rl.close();
            process.exit(0);
        } else {
            console.log("❌ Changelog rejected. Exiting...");
            rl.close();
            process.exit(1);
        }
    });
} catch (error) {
    console.error("❌ Error running Claude CLI:", error.message);
    console.log("💡 Make sure Claude CLI is installed and authenticated");
    process.exit(1);
}
