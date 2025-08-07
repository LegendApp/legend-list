export type AnimatedValueLike = number;

export const createAnimatedValue = (value: number): AnimatedValueLike => value;

export const createAnimatedEvent = (
    _mapping: any[],
    config?: { listener?: (event: any) => void; useNativeDriver?: boolean },
) => config?.listener || (() => {});
