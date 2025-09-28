import { useMemo } from "react";

import { useAnimatedValue } from "@/hooks/useAnimatedValue";
import type { ListenerType } from "@/state/state";
import { listen$, peek$, useStateContext } from "@/state/state";

export function useValue$(
    key: ListenerType,
    params?: {
        getValue?: (value: number) => number;
        delay?: number | undefined | ((value: number, prevValue: number | undefined) => number | undefined);
    },
) {
    const { getValue, delay } = params || {};
    const ctx = useStateContext();
    const animValue = useAnimatedValue((getValue ? getValue(peek$(ctx, key)) : peek$(ctx, key)) ?? 0);
    useMemo(() => {
        let newValue: number | undefined;
        let prevValue: number | undefined;
        let didQueueTask = false;
        listen$(ctx, key, (v) => {
            newValue = getValue ? getValue(v) : v;

            if (key === "totalSize") {
                console.log(Math.round(performance.now()), "useValue$ totalSize", newValue, prevValue);
            }

            if (delay !== undefined) {
                // Queue into a microtask because setting the value immediately was making the value
                // not actually set. I think it has to do with setting during useLayoutEffect, but I'm not sure.
                // This seems to be an optimization for setting totalSize because that can happen multiple times per frame
                // so we skip setting the value immediately if using the microtask version.
                const fn = () => {
                    didQueueTask = false;
                    if (newValue !== undefined) {
                        animValue.setValue(newValue!);
                    }
                };
                const delayValue = typeof delay === "function" ? delay(newValue!, prevValue) : delay;
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
