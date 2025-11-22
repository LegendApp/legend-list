import { useRef } from "react";
import { Animated } from "react-native";

export const useAnimatedValue = (initialValue: number): Animated.Value => {
    return useRef(new Animated.Value(initialValue)).current;
};
