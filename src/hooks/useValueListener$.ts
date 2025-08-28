import { useLayoutEffect } from "react";

import type { ListenerType, ListenerTypeValueMap } from "@/state/state";
import { listen$, useStateContext } from "@/state/state";

export function useValueListener$<T>(key: ListenerType, callback: (value: ListenerTypeValueMap[T]) => void) {
    const ctx = useStateContext();
    useLayoutEffect(() => {
        listen$(ctx, key, (value) => {
            callback(value);
        });
    }, []);
}
