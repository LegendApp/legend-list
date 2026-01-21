import { defineConfig } from "tsup";

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

const entryPoints: Record<string, string> = {
    animated: "src/integrations/animated.tsx",
    index: "src/index.ts",
    keyboard: "src/integrations/keyboard.tsx",
    "keyboard-controller": "src/integrations/keyboard-controller.tsx",
    reanimated: "src/integrations/reanimated.tsx",
    "section-list": "src/section-list/index.ts",
};

const nativeEntryPoints = Object.fromEntries(
    Object.entries(entryPoints).map(([key, value]) => [`${key}.native`, value]),
);

export default defineConfig([
    {
        clean: true,
        dts: true,
        entry: entryPoints,
        external,
        format: ["cjs", "esm"],
        splitting: false,
        treeshake: true,
    },
    {
        clean: false,
        dts: true,
        entry: nativeEntryPoints,
        esbuildOptions(options) {
            options.resolveExtensions = [".native.tsx", ".native.ts", ".tsx", ".ts", ".json"];
        },
        external,
        format: ["cjs", "esm"],
        splitting: false,
        treeshake: true,
    },
]);
