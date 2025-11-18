import { useMemo } from "react";

import { useAnimatedValue } from "@/hooks/useAnimatedValue";
import type { ListenerType } from "@/state/state";
import { listen$, peek$, useStateContext } from "@/state/state";
import { isFunction } from "@/utils/helpers";

export function useValue$(
    key: ListenerType,
    params?: {
        getValue?: (value: number) => number;
        delay?: number | undefined | ((value: number, prevValue: number | undefined) => number | undefined);
    },
) {
    const { getValue, delay } = params || {};
    const ctx = useStateContext();
    const getNewValue = () => (getValue ? getValue(peek$(ctx, key)) : peek$(ctx, key)) ?? 0;
    const animValue = useAnimatedValue(getNewValue());
    useMemo(() => {
        let prevValue: number | undefined;
        let didQueueTask = false;
        listen$(ctx, key, (v) => {
            const newValue = getNewValue();
            if (delay !== undefined) {
                // Queue into a microtask because setting the value immediately was making the value
                // not actually set. I think it has to do with setting during useLayoutEffect, but I'm not sure.
                // This seems to be an optimization for setting totalSize because that can happen multiple times per frame
                // so we skip setting the value immediately if using the microtask version.
                const fn = () => {
                    didQueueTask = false;
                    const latestValue = getNewValue();
                    if (latestValue !== undefined) {
                        animValue.setValue(latestValue!);
                    }
                };

                const delayValue = isFunction(delay) ? delay(newValue!, prevValue) : delay;
                prevValue = newValue;
                if (!didQueueTask) {
                    didQueueTask = true;
                    if (delayValue === undefined) {
                        fn();
                    } else if (delayValue === 0) {
                        queueMicrotask(fn);
                    } else {
                        // We're not clearing the timeout because we want it to run in the timeout from the first change
                        // but just not run multiple times.
                        setTimeout(fn, delayValue);
                    }
                }
            } else {
                animValue.setValue(newValue!);
            }
        });
    }, []);

    return animValue;
}
