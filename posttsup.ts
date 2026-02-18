import pkg from "./package.json";

const REACT_DTS_FILE = "dist/list-react.d.ts";
const RUNTIME_ENTRY_FILES = [
    "dist/index.js",
    "dist/index.mjs",
    "dist/index.native.js",
    "dist/index.native.mjs",
    "dist/list-react-native.js",
    "dist/list-react-native.mjs",
    "dist/list-react.js",
    "dist/list-react.mjs",
];

const REACT_NATIVE_IMPORT_REGEX = /from ["']react-native["']|import\(["']react-native["']\)/;
const FORBIDDEN_INTEGRATION_REGEX = /react-native-reanimated|react-native-keyboard-controller/;

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

const pkgOut = pkg as Record<string, any>;

pkg.private = false;
delete pkgOut.devDependencies;
delete pkgOut.overrides;
delete pkgOut.scripts;
delete pkgOut.engines;
delete pkgOut.commitlint;

Bun.write("dist/package.json", JSON.stringify(pkg, undefined, 2));
