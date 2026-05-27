import path from "node:path";
import pkg from "./package.json";

const DIST_DIR = path.resolve(process.cwd(), "dist");
const REACT_DTS_FILE = "dist/react.d.ts";
const RUNTIME_ENTRY_FILES = [
    "dist/react-native.js",
    "dist/react-native.mjs",
    "dist/react-native.web.js",
    "dist/react-native.web.mjs",
    "dist/react.js",
    "dist/react.mjs",
];
const INTEGRATION_ENTRYPOINTS = ["animated", "keyboard", "keyboard-legacy", "reanimated"] as const;
const INTEGRATION_BUNDLE_EXTENSIONS = [".js", ".mjs"] as const;
const LIST_SUBPATH_IMPORT_REGEX = /@legendapp\/list\/(animated|react-native|reanimated)/;
const INTEGRATION_REPACKAGED_CORE_PATTERNS = [
    {
        reason: "inlined state module",
        regex: /src\/state\/state\.tsx|function\s+useArr\$\s*\(|function\s+createSelectorFunctionsArr\s*\(/,
    },
    {
        reason: "inlined LegendList component module",
        regex: /src\/components\/LegendList\.tsx|function\s+LegendListInner(?:\d+)?\s*\(/,
    },
    { reason: "inlined core module", regex: /src\/core\// },
    { reason: "duplicate ContextState detected", regex: /ContextState\s*=\s*React\w*\.createContext\(null\)/ },
] as const;

const REACT_NATIVE_IMPORT_REGEX = /from ["']react-native["']|import\(["']react-native["']\)/;
const FORBIDDEN_INTEGRATION_REGEX = /react-native-reanimated|react-native-keyboard-controller/;

type IntegrationBundleCheckResult = {
    missingBundleFiles: string[];
    missingListSubpathImports: string[];
    repackagedCoreIssues: string[];
};

async function assertFileExists(file: string) {
    if (!(await Bun.file(file).exists())) {
        throw new Error(`Missing required build output: ${file}`);
    }
}

async function assertNoMatch(file: string, regex: RegExp, failureMessage: string) {
    await assertFileExists(file);
    const content = await Bun.file(file).text();

    if (regex.test(content)) {
        throw new Error(`${failureMessage}: ${file}`);
    }
}

async function checkIntegrationBundlesForCoreRepackaging(): Promise<IntegrationBundleCheckResult> {
    const missingBundleFiles: string[] = [];
    const missingListSubpathImports: string[] = [];
    const repackagedCoreIssues: string[] = [];

    for (const entrypoint of INTEGRATION_ENTRYPOINTS) {
        for (const extension of INTEGRATION_BUNDLE_EXTENSIONS) {
            const file = path.join(DIST_DIR, `${entrypoint}${extension}`);
            const relativeFile = path.relative(process.cwd(), file);
            const bundle = Bun.file(file);

            if (!(await bundle.exists())) {
                missingBundleFiles.push(relativeFile);
                continue;
            }

            const contents = await bundle.text();

            if (!LIST_SUBPATH_IMPORT_REGEX.test(contents)) {
                missingListSubpathImports.push(relativeFile);
            }

            for (const pattern of INTEGRATION_REPACKAGED_CORE_PATTERNS) {
                if (pattern.regex.test(contents)) {
                    repackagedCoreIssues.push(`${relativeFile}: ${pattern.reason}`);
                }
            }
        }
    }

    return { missingBundleFiles, missingListSubpathImports, repackagedCoreIssues };
}

async function assertIntegrationBundleIntegrity() {
    const integrationBundleChecks = await checkIntegrationBundlesForCoreRepackaging();
    const errors: string[] = [];

    if (integrationBundleChecks.missingBundleFiles.length > 0) {
        errors.push(
            [
                "Missing integration bundle outputs in dist:",
                ...integrationBundleChecks.missingBundleFiles.map((file) => ` - ${file}`),
            ].join("\n"),
        );
    }

    if (integrationBundleChecks.missingListSubpathImports.length > 0) {
        errors.push(
            [
                "Integration bundles do not reference @legendapp/list subpath imports (likely core was inlined):",
                ...integrationBundleChecks.missingListSubpathImports.map((file) => ` - ${file}`),
            ].join("\n"),
        );
    }

    if (integrationBundleChecks.repackagedCoreIssues.length > 0) {
        errors.push(
            [
                "Integration bundles appear to re-package core code:",
                ...integrationBundleChecks.repackagedCoreIssues.map((issue) => ` - ${issue}`),
            ].join("\n"),
        );
    }

    if (errors.length > 0) {
        throw new Error(errors.join("\n\n"));
    }
}

async function copy(...files: string[]) {
    return Promise.all(
        files.map((file) =>
            Bun.write("dist/" + file.replace("src/", ""), Bun.file(file), { createPath: true }),
        ),
    );
}

await copy("LICENSE", "CHANGELOG.md", "README.md");

await assertNoMatch(
    REACT_DTS_FILE,
    REACT_NATIVE_IMPORT_REGEX,
    "React Native import found in react type entrypoint",
);

for (const file of RUNTIME_ENTRY_FILES) {
    await assertNoMatch(
        file,
        FORBIDDEN_INTEGRATION_REGEX,
        "Integration dependency leaked into core entrypoint bundle",
    );
}

await assertIntegrationBundleIntegrity();

const pkgOut = pkg as Record<string, any>;

pkg.private = false;
delete pkgOut.devDependencies;
delete pkgOut.overrides;
delete pkgOut.scripts;
delete pkgOut.engines;
delete pkgOut.commitlint;

Bun.write("dist/package.json", JSON.stringify(pkg, undefined, 2));
