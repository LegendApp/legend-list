import { useLayoutEffect, useRef } from "react";

import { useAnimatedValue } from "@/hooks/useAnimatedValue";
import type { ListenerType } from "@/state/state";
import { listen$, peek$, useStateContext } from "@/state/state";

export function useValue$(
    key: ListenerType,
    params?: {
        getValue?: (value: number) => number;
    },
) {
    const { getValue } = params || {};
    const ctx = useStateContext();
    const getNewValue = () => (getValue ? getValue(peek$(ctx, key)) : peek$(ctx, key)) ?? 0;
    const initialValue = getNewValue();
    const animValue = useAnimatedValue(initialValue);
    const lastValue = useRef(initialValue);
    useLayoutEffect(() => {
        const syncCurrentValue = () => {
            const nextValue = getNewValue();
            if (lastValue.current !== nextValue) {
                lastValue.current = nextValue;
                animValue.setValue(nextValue);
            }
        };
        const unsubscribe = listen$(ctx, key, syncCurrentValue);
        syncCurrentValue();
        return unsubscribe;
    }, [animValue, ctx, key]);

    return animValue;
}
