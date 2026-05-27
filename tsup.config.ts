import { defineConfig, type Options } from "tsup";

const external = [
    "react",
    "react-dom",
    "react-native",
    "react-native-keyboard-controller",
    "react-native-reanimated",
    "@legendapp/list",
    "@legendapp/list/animated",
    "@legendapp/list/reanimated",
];

const webEntryPoints: Record<string, string> = {
    index: "src/index.ts",
    react: "src/react.ts",
    "react-native.web": "src/react.ts",
};

const nativeEntryPoints = {
    animated: "src/integrations/animated.tsx",
    keyboard: "src/integrations/keyboard.tsx",
    "keyboard-legacy": "src/integrations/keyboard-legacy.tsx",
    "react-native": "src/react-native.ts",
    reanimated: "src/integrations/reanimated.tsx",
    "section-list": "src/section-list/index.ts",
};

const specialEntryPoints = {
    "index.native": "src/index.ts",
};

const dtsEntryPoints = {
    ...webEntryPoints,
    ...nativeEntryPoints,
};

const dtsConfigs: Options[] = Object.entries(dtsEntryPoints).map(([name, entry]) => ({
    clean: false,
    dts: { only: true },
    entry: { [name]: entry },
    external,
    format: ["cjs"],
    name: `dts:${name}`,
    silent: true,
    splitting: false,
}));

export default defineConfig([
    {
        clean: true,
        dts: false,
        entry: webEntryPoints,
        external,
        format: ["cjs", "esm"],
        silent: true,
        splitting: false,
        treeshake: true,
    },
    {
        clean: false,
        dts: false,
        entry: { ...nativeEntryPoints, ...specialEntryPoints },
        esbuildOptions(options) {
            options.resolveExtensions = [".native.tsx", ".native.ts", ".tsx", ".ts", ".json"];
        },
        external,
        format: ["cjs", "esm"],
        silent: true,
        splitting: false,
        treeshake: true,
    },
    ...dtsConfigs,
]);
