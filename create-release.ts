#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { join } from "node:path";

function extractChangelogNotes(): string {
    const changelogPath = join(process.cwd(), "CHANGELOG.md");
    const changelogContent = readFileSync(changelogPath, "utf-8");

    const lines = changelogContent.split("\n");
    const releaseNotes: string[] = [];
    let foundFirstHeader = false;

    for (const line of lines) {
        if (line.startsWith("## ")) {
            if (foundFirstHeader) {
                // We've hit the second header, stop collecting notes
                break;
            }
            foundFirstHeader = true;
            continue; // Skip the first header line itself
        }

        if (foundFirstHeader) {
            releaseNotes.push(line);
        }
    }

    // Remove trailing empty lines
    while (releaseNotes.length > 0 && releaseNotes[releaseNotes.length - 1].trim() === "") {
        releaseNotes.pop();
    }

    return releaseNotes.join("\n").trim();
}

async function createRelease() {
    try {
        // Read package.json to get version
        const packagePath = join(process.cwd(), "package.json");
        const packageContent = readFileSync(packagePath, "utf-8");
        const packageJson = JSON.parse(packageContent);
        const version = packageJson.version;

        // Extract release notes from changelog
        const releaseNotes = extractChangelogNotes();

        if (!releaseNotes) {
            console.error("Error: No release notes found in CHANGELOG.md");
            process.exit(1);
        }

        const tagName = `v${version}`;
        const title = `v${version}`;

        console.log(`Creating release ${tagName}...`);
        console.log("Release notes:");
        console.log(releaseNotes);

        // Create the GitHub release using stdin for release notes to handle special characters
        const proc = Bun.spawn(
            ["gh", "release", "create", tagName, "--title", title, "--notes-file", "-", "--latest"],
            {
                stdin: "pipe",
            },
        );

        proc.stdin?.write(releaseNotes);
        proc.stdin?.end();

        await proc.exited;

        console.log(`✅ Successfully created release ${tagName}`);
    } catch (error) {
        console.error("Error creating release:", error);
        process.exit(1);
    }
}

createRelease();
