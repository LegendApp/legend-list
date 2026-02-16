import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const SRC_DIR = path.resolve(process.cwd(), "src");
const TARGET_LINE = 'import * as React from "react";';
const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const TSX_EXTENSION = ".tsx";
const ROOT_PACKAGE_SPECIFIER = "@legendapp/list";
const TYPES_BASE_FILE = path.join(SRC_DIR, "types.base.ts");
const TYPES_ROOT_FILE = path.join(SRC_DIR, "types.root.ts");
const TYPES_BASE_IMPORT_SPECIFIER = "@/types.base";

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

function findDirectRootPackageImportsInFile(filePath: string, contents: string): string[] {
    const sourceFile = ts.createSourceFile(
        filePath,
        contents,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith(TSX_EXTENSION) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const occurrences: string[] = [];

    const recordIfRootSpecifier = (specifier: ts.Expression | undefined) => {
        if (
            specifier &&
            (ts.isStringLiteral(specifier) || ts.isNoSubstitutionTemplateLiteral(specifier)) &&
            specifier.text === ROOT_PACKAGE_SPECIFIER
        ) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(specifier.getStart(sourceFile));
            occurrences.push(`${path.relative(process.cwd(), filePath)}:${line + 1}`);
        }
    };

    const visit = (node: ts.Node) => {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
            recordIfRootSpecifier(node.moduleSpecifier);
        } else if (ts.isCallExpression(node)) {
            const firstArg = node.arguments[0];
            const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
            const isRequireCall = ts.isIdentifier(node.expression) && node.expression.text === "require";

            if (isDynamicImport || isRequireCall) {
                recordIfRootSpecifier(firstArg);
            }
        } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
            recordIfRootSpecifier(node.argument.literal);
        }

        ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return occurrences;
}

async function findDirectRootPackageImports(sourceFiles: string[]): Promise<string[]> {
    const occurrences: string[] = [];

    for (const file of sourceFiles) {
        const contents = await readFile(file, "utf8");
        occurrences.push(...findDirectRootPackageImportsInFile(file, contents));
    }

    return occurrences;
}

function isExportedTypeDeclaration(node: ts.Node): node is ts.InterfaceDeclaration | ts.TypeAliasDeclaration {
    if (!ts.isInterfaceDeclaration(node) && !ts.isTypeAliasDeclaration(node)) {
        return false;
    }

    return node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function hasDeprecatedTag(node: ts.Node): boolean {
    return ts.getJSDocTags(node).some((tag) => tag.tagName.text === "deprecated");
}

function parseExportedTypes(filePath: string, contents: string): Map<string, ts.InterfaceDeclaration | ts.TypeAliasDeclaration> {
    const sourceFile = ts.createSourceFile(filePath, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const exportedTypes = new Map<string, ts.InterfaceDeclaration | ts.TypeAliasDeclaration>();

    for (const statement of sourceFile.statements) {
        if (isExportedTypeDeclaration(statement)) {
            exportedTypes.set(statement.name.text, statement);
        }
    }

    return exportedTypes;
}

function findExportAllFromTypesBase(filePath: string, contents: string): string[] {
    const sourceFile = ts.createSourceFile(filePath, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const occurrences: string[] = [];

    for (const statement of sourceFile.statements) {
        if (!ts.isExportDeclaration(statement)) {
            continue;
        }

        const moduleSpecifier = statement.moduleSpecifier;
        const isTypesBaseModule =
            moduleSpecifier &&
            ts.isStringLiteral(moduleSpecifier) &&
            moduleSpecifier.text === TYPES_BASE_IMPORT_SPECIFIER;

        if (!isTypesBaseModule) {
            continue;
        }

        if (!statement.exportClause) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile));
            occurrences.push(`${path.relative(process.cwd(), filePath)}:${line + 1}`);
        }
    }

    return occurrences;
}

type RootTypeCoverageResult = {
    baseTypeCount: number;
    missingInRoot: string[];
    missingDeprecated: string[];
    exportAllFromBase: string[];
};

async function checkRootTypeCoverage(): Promise<RootTypeCoverageResult> {
    const [baseContents, rootContents] = await Promise.all([
        readFile(TYPES_BASE_FILE, "utf8"),
        readFile(TYPES_ROOT_FILE, "utf8"),
    ]);

    const baseExportedTypes = parseExportedTypes(TYPES_BASE_FILE, baseContents);
    const rootExportedTypes = parseExportedTypes(TYPES_ROOT_FILE, rootContents);

    const missingInRoot: string[] = [];
    const missingDeprecated: string[] = [];

    for (const [typeName] of baseExportedTypes) {
        const rootTypeNode = rootExportedTypes.get(typeName);
        if (!rootTypeNode) {
            missingInRoot.push(typeName);
            continue;
        }

        if (!hasDeprecatedTag(rootTypeNode)) {
            missingDeprecated.push(typeName);
        }
    }

    const exportAllFromBase = findExportAllFromTypesBase(TYPES_ROOT_FILE, rootContents);

    missingInRoot.sort();
    missingDeprecated.sort();

    return {
        baseTypeCount: baseExportedTypes.size,
        missingInRoot,
        missingDeprecated,
        exportAllFromBase,
    };
}

async function run() {
    const tsxFiles = await collectFiles([TSX_EXTENSION]);
    const sourceFiles = await collectFiles(SOURCE_EXTENSIONS);
    const missingReactImports = await findMissingReactImports(tsxFiles);
    const consoleLogs = await findConsoleLogs(sourceFiles);
    const directRootPackageImports = await findDirectRootPackageImports(sourceFiles);
    const rootTypeCoverage = await checkRootTypeCoverage();

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

    if (directRootPackageImports.length > 0) {
        console.error(`Direct "${ROOT_PACKAGE_SPECIFIER}" imports found in src (use subpaths instead):`);
        for (const occurrence of directRootPackageImports) {
            console.error(` - ${occurrence}`);
        }
        hasErrors = true;
    }

    if (rootTypeCoverage.exportAllFromBase.length > 0) {
        console.error(`Disallowed export-all from "${TYPES_BASE_IMPORT_SPECIFIER}" found in src/types.root.ts:`);
        for (const occurrence of rootTypeCoverage.exportAllFromBase) {
            console.error(` - ${occurrence}`);
        }
        hasErrors = true;
    }

    if (rootTypeCoverage.missingInRoot.length > 0) {
        console.error("Missing root re-exports for types exported by src/types.base.ts:");
        for (const typeName of rootTypeCoverage.missingInRoot) {
            console.error(` - ${typeName}`);
        }
        hasErrors = true;
    }

    if (rootTypeCoverage.missingDeprecated.length > 0) {
        console.error("Missing @deprecated tag on root type re-exports:");
        for (const typeName of rootTypeCoverage.missingDeprecated) {
            console.error(` - ${typeName}`);
        }
        hasErrors = true;
    }

    if (hasErrors) {
        process.exitCode = 1;
        return;
    }

    console.log(`Verified React import in ${tsxFiles.length} .tsx files.`);
    console.log(`Verified no console.log statements in ${sourceFiles.length} source files.`);
    console.log(`Verified no direct "${ROOT_PACKAGE_SPECIFIER}" imports in ${sourceFiles.length} source files.`);
    console.log(
        `Verified ${rootTypeCoverage.baseTypeCount} exported base types are re-exported and deprecated in src/types.root.ts.`,
    );
}

run().catch((error) => {
    console.error("Failed to run prebuild check:", error);
    process.exitCode = 1;
});
