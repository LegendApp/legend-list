import { Animated } from "react-native";

export type AnimatedValueLike = Animated.Value;

export const createAnimatedValue = (value: number): Animated.Value => new Animated.Value(value);

export const createAnimatedEvent = Animated.event;
