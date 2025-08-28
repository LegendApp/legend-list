import { Animated } from "react-native";

export const createAnimatedValue = (value: number): Animated.Value => new Animated.Value(value);

export const createAnimatedEvent = Animated.event;
