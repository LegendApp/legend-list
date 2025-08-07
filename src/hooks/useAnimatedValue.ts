import { useRef } from "react";

import { createAnimatedValue } from "@/platform/AnimatedValue";

export const useAnimatedValue = (initialValue: number): any => {
    return useRef(createAnimatedValue(initialValue)).current;
};
