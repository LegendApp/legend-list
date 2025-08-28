export const createAnimatedValue = (value: number): number => value;

export const createAnimatedEvent = (
    _mapping: any[],
    config?: { listener?: (event: any) => void; useNativeDriver?: boolean },
) => config?.listener || (() => {});
