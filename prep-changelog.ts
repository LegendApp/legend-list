#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { accessSync, constants, readFileSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";
import { createInterface } from "node:readline";

const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));
const currentVersion = packageJson.version;
const changelog = readFileSync("./CHANGELOG.md", "utf-8");
const prompt = "update the changelog with the changes in the latest version. See changelog.mdc for more details.";

type AgentCli = {
    name: string;
    command: string;
    args: string[];
};

type AvailableAgentCli = AgentCli & {
    executablePath: string;
};

function isExecutable(path: string): boolean {
    try {
        accessSync(path, constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

function findExecutable(command: string): string | undefined {
    if (isAbsolute(command)) {
        return isExecutable(command) ? command : undefined;
    }

    for (const directory of process.env.PATH?.split(delimiter) ?? []) {
        const executablePath = join(directory, command);
        if (isExecutable(executablePath)) {
            return executablePath;
        }
    }
}

const agentCli = (
    [
        {
            args: ["--ask-for-approval", "never", "exec", "--sandbox", "workspace-write", prompt],
            command: "codex",
            name: "Codex",
        },
        {
            args: ["-p", prompt],
            command: "/Users/jay/.claude/local/claude",
            name: "Claude",
        },
        {
            args: ["-p", prompt],
            command: "claude",
            name: "Claude",
        },
    ] satisfies AgentCli[]
).reduce<AvailableAgentCli | undefined>((availableCli, cli) => {
    if (availableCli) {
        return availableCli;
    }

    const executablePath = findExecutable(cli.command);
    if (executablePath) {
        return {
            ...cli,
            executablePath,
        };
    }
}, undefined);

if (/-((beta)|(next))/i.test(currentVersion)) {
    console.error(
        `❌ Version ${currentVersion} is a prerelease tag (beta/next). Please set a stable version before preparing the changelog.`,
    );
    process.exit(1);
}

// Check if current version already exists in changelog
const versionHeader = `## ${currentVersion}`;
if (changelog.includes(versionHeader)) {
    console.log(`✅ Version ${currentVersion} already exists in CHANGELOG.md`);
    process.exit(0);
}

console.log(`🔍 Version ${currentVersion} not found in CHANGELOG.md`);
if (!agentCli) {
    console.error("❌ Codex CLI and Claude CLI were not found. Install one of them before preparing the changelog.");
    process.exit(1);
}

console.log(`📝 Generating changelog entry using ${agentCli.name} CLI...`);

// Run an available agent CLI to update changelog
try {
    const result = spawnSync(agentCli.executablePath, agentCli.args, {
        stdio: "inherit",
    });

    if (result.status === 0) {
        console.log(`\n✅ ${agentCli.name} CLI execution completed.`);

        // Prompt for confirmation
        const rl = createInterface({
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
    } else {
        console.error(`❌ ${agentCli.name} CLI exited with status ${result.status ?? "unknown"}.`);
        process.exit(1);
    }
} catch (error) {
    console.error(`❌ Error running ${agentCli.name} CLI:`, error instanceof Error ? error.message : error);
    console.log(`💡 Make sure ${agentCli.name} CLI is installed and authenticated`);
    process.exit(1);
}
