import { defineConfig } from "tsup";

const external = [
    "react",
    "react-native",
    "react-native-keyboard-controller",
    "react-native-reanimated",
    "@legendapp/list",
    "@legendapp/list/animated",
    "@legendapp/list/reanimated",
];

export default defineConfig({
    clean: true,
    dts: true,
    entry: {
        animated: "src/integrations/animated.tsx",
        index: "src/index.ts",
        "keyboard-controller": "src/integrations/keyboard-controller.tsx",
        reanimated: "src/integrations/reanimated.tsx",
    },
    external,
    format: ["cjs", "esm"],
    splitting: false,
    treeshake: true,
});
