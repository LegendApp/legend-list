import { useState } from "react";
import { Animated } from "react-native";

export const useAnimatedValue = (initialValue: number): Animated.Value => {
    const [animAnimatedValue] = useState(() => new Animated.Value(initialValue));
    return animAnimatedValue;
};
