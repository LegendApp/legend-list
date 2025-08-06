import { useRef } from "react";
import { Animated } from "@/platform/Animated";

export const useAnimatedValue = (initialValue: number): InstanceType<typeof Animated.Value> => {
    return useRef(new Animated.Value(initialValue)).current;
};
