import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const SRC_DIR = path.resolve(process.cwd(), "src");
const INTEGRATIONS_DIR = path.join(SRC_DIR, "integrations");
const TARGET_LINE = 'import * as React from "react";';
const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const TSX_EXTENSION = ".tsx";
const ROOT_PACKAGE_SPECIFIER = "@legendapp/list";
const TYPES_BASE_FILE = path.join(SRC_DIR, "types.base.ts");
const TYPES_INTERNAL_IMPORT_SPECIFIER = "@/types.internal";
const TYPES_ROOT_FILE = path.join(SRC_DIR, "types.root.ts");
const TYPES_REACT_NATIVE_FILE = path.join(SRC_DIR, "types.react-native.ts");
const TYPES_BASE_IMPORT_SPECIFIER = "@/types.base";
const TYPES_WEB_FILE = path.join(SRC_DIR, "types.web.ts");
const LOCAL_INTEGRATION_IMPORT_PREFIXES = ["@/", "./", "../", "/", "src/"] as const;

async function collectFiles(extensions: string[]): Promise<string[]> {
    const entries = await readdir(SRC_DIR, { recursive: true });

    return entries
        .filter((entry) => extensions.some((extension) => entry.endsWith(extension)))
        .map((entry) => path.join(SRC_DIR, entry));
}

async function collectIntegrationFiles(): Promise<string[]> {
    const entries = await readdir(INTEGRATIONS_DIR);

    return entries
        .filter((entry) => SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension)))
        .map((entry) => path.join(INTEGRATIONS_DIR, entry));
}

function getLiteralModuleSpecifierText(specifier: ts.Expression | undefined): string | null {
    if (!specifier) {
        return null;
    }

    if (ts.isStringLiteral(specifier) || ts.isNoSubstitutionTemplateLiteral(specifier)) {
        return specifier.text;
    }

    return null;
}

function isLocalIntegrationImport(specifier: string): boolean {
    return LOCAL_INTEGRATION_IMPORT_PREFIXES.some((prefix) => specifier.startsWith(prefix));
}

function findLocalIntegrationImportsInFile(filePath: string, contents: string): string[] {
    const sourceFile = ts.createSourceFile(
        filePath,
        contents,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith(TSX_EXTENSION) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const occurrences: string[] = [];

    const recordIfLocal = (specifierNode: ts.Expression | undefined) => {
        const specifier = getLiteralModuleSpecifierText(specifierNode);
        if (!specifier || !isLocalIntegrationImport(specifier)) {
            return;
        }

        const { line } = sourceFile.getLineAndCharacterOfPosition(specifierNode!.getStart(sourceFile));
        occurrences.push(`${path.relative(process.cwd(), filePath)}:${line + 1} (${specifier})`);
    };

    const visit = (node: ts.Node) => {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
            recordIfLocal(node.moduleSpecifier);
        } else if (ts.isCallExpression(node)) {
            const firstArg = node.arguments[0];
            const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
            const isRequireCall = ts.isIdentifier(node.expression) && node.expression.text === "require";

            if (isDynamicImport || isRequireCall) {
                recordIfLocal(firstArg);
            }
        } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
            recordIfLocal(node.argument.literal);
        }

        ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return occurrences;
}

async function findLocalIntegrationImports(integrationFiles: string[]): Promise<string[]> {
    const occurrences: string[] = [];

    for (const file of integrationFiles) {
        const contents = await readFile(file, "utf8");
        occurrences.push(...findLocalIntegrationImportsInFile(file, contents));
    }

    return occurrences;
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

function hasInternalTag(node: ts.Node): boolean {
    return ts.getJSDocTags(node).some((tag) => tag.tagName.text === "internal");
}

function parseExportedTypes(
    filePath: string,
    contents: string,
): Map<string, ts.InterfaceDeclaration | ts.TypeAliasDeclaration> {
    const sourceFile = ts.createSourceFile(filePath, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const exportedTypes = new Map<string, ts.InterfaceDeclaration | ts.TypeAliasDeclaration>();

    for (const statement of sourceFile.statements) {
        if (isExportedTypeDeclaration(statement)) {
            if (hasInternalTag(statement)) {
                continue;
            }
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

function collectImportedBindings(
    sourceFile: ts.SourceFile,
    moduleSpecifierText: string,
): { named: Set<string>; namespaces: Set<string> } {
    const named = new Set<string>();
    const namespaces = new Set<string>();

    for (const statement of sourceFile.statements) {
        if (!ts.isImportDeclaration(statement)) {
            continue;
        }

        const moduleSpecifier = statement.moduleSpecifier;
        if (!ts.isStringLiteral(moduleSpecifier) || moduleSpecifier.text !== moduleSpecifierText) {
            continue;
        }

        const importClause = statement.importClause;
        const namedBindings = importClause?.namedBindings;

        if (namedBindings && ts.isNamedImports(namedBindings)) {
            for (const element of namedBindings.elements) {
                named.add(element.name.text);
            }
        } else if (namedBindings && ts.isNamespaceImport(namedBindings)) {
            namespaces.add(namedBindings.name.text);
        }
    }

    return { named, namespaces };
}

function exportedDeclarationUsesBindings(
    node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration,
    bindings: { named: Set<string>; namespaces: Set<string> },
): boolean {
    let usesBinding = false;

    const visit = (current: ts.Node) => {
        if (usesBinding) {
            return;
        }

        if (ts.isIdentifier(current) && bindings.named.has(current.text)) {
            usesBinding = true;
            return;
        }

        if (ts.isPropertyAccessExpression(current) && ts.isIdentifier(current.expression)) {
            if (bindings.namespaces.has(current.expression.text)) {
                usesBinding = true;
                return;
            }
        }

        ts.forEachChild(current, visit);
    };

    visit(node);
    return usesBinding;
}

type PublicTypeEntrypointResult = {
    exportAllFromBase: string[];
    internalReexports: string[];
    exportedDeclarationsUsingInternal: string[];
};

function checkPublicTypeEntrypoint(filePath: string, contents: string): PublicTypeEntrypointResult {
    const sourceFile = ts.createSourceFile(filePath, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const exportAllFromBase = findExportAllFromTypesBase(filePath, contents);
    const internalReexports: string[] = [];
    const exportedDeclarationsUsingInternal: string[] = [];
    const internalBindings = collectImportedBindings(sourceFile, TYPES_INTERNAL_IMPORT_SPECIFIER);

    for (const statement of sourceFile.statements) {
        if (ts.isExportDeclaration(statement)) {
            const moduleSpecifier = statement.moduleSpecifier;
            if (
                moduleSpecifier &&
                ts.isStringLiteral(moduleSpecifier) &&
                moduleSpecifier.text === TYPES_INTERNAL_IMPORT_SPECIFIER
            ) {
                const { line } = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile));
                internalReexports.push(`${path.relative(process.cwd(), filePath)}:${line + 1}`);
            }
            continue;
        }

        if (isExportedTypeDeclaration(statement)) {
            if (exportedDeclarationUsesBindings(statement, internalBindings)) {
                const { line } = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile));
                exportedDeclarationsUsingInternal.push(
                    `${path.relative(process.cwd(), filePath)}:${line + 1} (${statement.name.text})`,
                );
            }
        }
    }

    return {
        exportAllFromBase,
        exportedDeclarationsUsingInternal,
        internalReexports,
    };
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
        exportAllFromBase,
        missingDeprecated,
        missingInRoot,
    };
}

async function run() {
    const tsxFiles = await collectFiles([TSX_EXTENSION]);
    const sourceFiles = await collectFiles(SOURCE_EXTENSIONS);
    const integrationFiles = await collectIntegrationFiles();
    const missingReactImports = await findMissingReactImports(tsxFiles);
    const consoleLogs = await findConsoleLogs(sourceFiles);
    const directRootPackageImports = await findDirectRootPackageImports(sourceFiles);
    const localIntegrationImports = await findLocalIntegrationImports(integrationFiles);
    const rootTypeCoverage = await checkRootTypeCoverage();
    const [typesWebContents, typesReactNativeContents] = await Promise.all([
        readFile(TYPES_WEB_FILE, "utf8"),
        readFile(TYPES_REACT_NATIVE_FILE, "utf8"),
    ]);
    const publicTypeEntrypoints = [
        checkPublicTypeEntrypoint(TYPES_WEB_FILE, typesWebContents),
        checkPublicTypeEntrypoint(TYPES_REACT_NATIVE_FILE, typesReactNativeContents),
    ];

    const errors: string[] = [];

    if (missingReactImports.length > 0) {
        errors.push(
            ["Missing React import in the following files:", ...missingReactImports.map((file) => ` - ${file}`)].join(
                "\n",
            ),
        );
    }

    if (consoleLogs.length > 0) {
        errors.push(
            ["console.log statements found in src:", ...consoleLogs.map((occurrence) => ` - ${occurrence}`)].join("\n"),
        );
    }

    if (directRootPackageImports.length > 0) {
        errors.push(
            [
                `Direct "${ROOT_PACKAGE_SPECIFIER}" imports found in src (use subpaths instead):`,
                ...directRootPackageImports.map((occurrence) => ` - ${occurrence}`),
            ].join("\n"),
        );
    }

    if (localIntegrationImports.length > 0) {
        errors.push(
            [
                "Local imports found in src/integrations (use @legendapp/list subpath imports only):",
                ...localIntegrationImports.map((occurrence) => ` - ${occurrence}`),
            ].join("\n"),
        );
    }

    if (rootTypeCoverage.exportAllFromBase.length > 0) {
        errors.push(
            [
                `Disallowed export-all from "${TYPES_BASE_IMPORT_SPECIFIER}" found in src/types.root.ts:`,
                ...rootTypeCoverage.exportAllFromBase.map((occurrence) => ` - ${occurrence}`),
            ].join("\n"),
        );
    }

    if (rootTypeCoverage.missingInRoot.length > 0) {
        errors.push(
            [
                "Missing root re-exports for types exported by src/types.base.ts:",
                ...rootTypeCoverage.missingInRoot.map((typeName) => ` - ${typeName}`),
            ].join("\n"),
        );
    }

    if (rootTypeCoverage.missingDeprecated.length > 0) {
        errors.push(
            [
                "Missing @deprecated tag on root type re-exports:",
                ...rootTypeCoverage.missingDeprecated.map((typeName) => ` - ${typeName}`),
            ].join("\n"),
        );
    }

    for (const result of publicTypeEntrypoints) {
        if (result.exportAllFromBase.length > 0) {
            errors.push(
                [
                    `Disallowed export-all from "${TYPES_BASE_IMPORT_SPECIFIER}" found in strict platform type entrypoints:`,
                    ...result.exportAllFromBase.map((occurrence) => ` - ${occurrence}`),
                ].join("\n"),
            );
        }

        if (result.internalReexports.length > 0) {
            errors.push(
                [
                    `Disallowed re-exports from "${TYPES_INTERNAL_IMPORT_SPECIFIER}" found in strict platform type entrypoints:`,
                    ...result.internalReexports.map((occurrence) => ` - ${occurrence}`),
                ].join("\n"),
            );
        }

        if (result.exportedDeclarationsUsingInternal.length > 0) {
            errors.push(
                [
                    `Strict platform type entrypoints export declarations that directly reference "${TYPES_INTERNAL_IMPORT_SPECIFIER}":`,
                    ...result.exportedDeclarationsUsingInternal.map((occurrence) => ` - ${occurrence}`),
                ].join("\n"),
            );
        }
    }

    if (errors.length > 0) {
        throw new Error(errors.join("\n\n"));
    }
}

void run().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
});
