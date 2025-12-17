import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const SRC_DIR = path.resolve(process.cwd(), "src");
const TARGET_LINE = 'import * as React from "react";';
const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const TSX_EXTENSION = ".tsx";

async function collectFiles(extensions: string[]): Promise<string[]> {
    const entries = await readdir(SRC_DIR, { recursive: true });

    return entries
        .filter((entry) => extensions.some((extension) => entry.endsWith(extension)))
        .map((entry) => path.join(SRC_DIR, entry));
}

async function findMissingReactImports(tsxFiles: string[]): Promise<string[]> {
    const missing: string[] = [];

    for (const file of tsxFiles) {
        const contents = await readFile(file, "utf8");
        const hasTargetLine = contents.split(/\r?\n/).some((line) => line.trim() === TARGET_LINE);

        if (!hasTargetLine) {
            missing.push(path.relative(process.cwd(), file));
        }
    }

    return missing;
}

function findConsoleLogOccurrences(filePath: string, contents: string): string[] {
    const sourceFile = ts.createSourceFile(
        filePath,
        contents,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith(TSX_EXTENSION) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const occurrences: string[] = [];

    const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
            const expression = node.expression;

            if (ts.isPropertyAccessExpression(expression) && expression.name.text === "log") {
                if (expression.expression.getText(sourceFile) === "console") {
                    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                    occurrences.push(`${path.relative(process.cwd(), filePath)}:${line + 1}`);
                }
            }
        }

        ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return occurrences;
}

async function findConsoleLogs(sourceFiles: string[]): Promise<string[]> {
    const occurrences: string[] = [];

    for (const file of sourceFiles) {
        const contents = await readFile(file, "utf8");
        occurrences.push(...findConsoleLogOccurrences(file, contents));
    }

    return occurrences;
}

async function run() {
    const tsxFiles = await collectFiles([TSX_EXTENSION]);
    const sourceFiles = await collectFiles(SOURCE_EXTENSIONS);
    const missingReactImports = await findMissingReactImports(tsxFiles);
    const consoleLogs = await findConsoleLogs(sourceFiles);

    let hasErrors = false;

    if (missingReactImports.length > 0) {
        console.error("Missing React import in the following files:");
        for (const file of missingReactImports) {
            console.error(` - ${file}`);
        }
        hasErrors = true;
    }

    if (consoleLogs.length > 0) {
        console.error("console.log statements found in src:");
        for (const occurrence of consoleLogs) {
            console.error(` - ${occurrence}`);
        }
        hasErrors = true;
    }

    if (hasErrors) {
        process.exitCode = 1;
        return;
    }

    console.log(`Verified React import in ${tsxFiles.length} .tsx files.`);
    console.log(`Verified no console.log statements in ${sourceFiles.length} source files.`);
}

run().catch((error) => {
    console.error("Failed to run prebuild check:", error);
    process.exitCode = 1;
});
