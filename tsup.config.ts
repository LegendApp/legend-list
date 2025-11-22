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

export default defineConfig([
    {
        clean: true,
        dts: true,
        entry: {
            animated: "src/integrations/animated.tsx",
            index: "src/index.ts",
            "keyboard-controller": "src/integrations/keyboard-controller.tsx",
            reanimated: "src/integrations/reanimated.tsx",
            "section-list": "src/section-list/index.ts",
        },
        external,
        format: ["cjs", "esm"],
        splitting: false,
        treeshake: true,
    },
    {
        clean: false,
        dts: true,
        entry: {
            "index.native": "src/index.ts",
            "section-list.native": "src/section-list/index.ts",
        },
        esbuildOptions(options) {
            options.resolveExtensions = [".native.tsx", ".native.ts", ".tsx", ".ts", ".json"];
        },
        external,
        format: ["cjs", "esm"],
        splitting: false,
        treeshake: true,
    },
]);
