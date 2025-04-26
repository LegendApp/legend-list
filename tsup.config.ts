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
    entry: ["src/index.ts", "src/animated.tsx", "src/reanimated.tsx", "src/keyboard-controller.tsx"],
    format: ["cjs", "esm"],
    external,
    dts: true,
    treeshake: true,
    splitting: false,
    clean: true,
});
