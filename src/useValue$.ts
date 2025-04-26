import { useMemo } from "react";
import { listen$, peek$, useStateContext } from "./state";
import type { ListenerType } from "./state";
import { useAnimatedValue } from "./useAnimatedValue";

export function useValue$(key: ListenerType, getValue?: (value: number) => number, useMicrotask?: boolean) {
    const ctx = useStateContext();
    const animValue = useAnimatedValue((getValue ? getValue(peek$(ctx, key)) : peek$(ctx, key)) ?? 0);
    useMemo(() => {
        let newValue: number | undefined = undefined;
        listen$(ctx, key, (v) => {
            if (useMicrotask && newValue === undefined) {
                // Queue into a microtask because setting the value immediately was making the value
                // not actually set. I think it has to do with setting during useLayoutEffect, but I'm not sure.
                // This seems to be an optimization for setting totalSize because that can happen multiple times per frame
                // so we skip setting the value immediately if using the microtask version.
                queueMicrotask(() => {
                    animValue.setValue(newValue!);
                    newValue = undefined;
                });
            }
            newValue = getValue ? getValue(v) : v;
            if (!useMicrotask) {
                animValue.setValue(newValue!);
            }
        });
    }, []);

    return animValue;
}
