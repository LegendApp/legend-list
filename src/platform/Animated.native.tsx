// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";
import { Animated } from "react-native";

export const createAnimatedValue = (value: number): Animated.Value => new Animated.Value(value);
export type AnimatedValue = Animated.Value;
