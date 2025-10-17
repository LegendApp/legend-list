// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";
import { Animated, Text as RNText, View as RNView } from "react-native";

export const AnimatedView = Animated.View;
export const View = RNView;
export const Text = RNText;
