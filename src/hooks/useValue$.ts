import { useLayoutEffect } from "react";

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
    const animValue = useAnimatedValue(getNewValue());
    useLayoutEffect(() => {
        const syncCurrentValue = () => {
            animValue.setValue(getNewValue());
        };
        const unsubscribe = listen$(ctx, key, syncCurrentValue);
        syncCurrentValue();
        return unsubscribe;
    }, [animValue, ctx, key]);

    return animValue;
}
