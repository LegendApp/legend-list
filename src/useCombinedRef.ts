import { useCallback } from "react";
import { isFunction } from "./helpers";

type RefItem<T> = ((element: T | null) => void) | React.MutableRefObject<T | null> | null | undefined;

export const useCombinedRef = <T>(...refs: RefItem<T>[]) => {
    const callback = useCallback((element: T | null) => {
        for (const ref of refs) {
            if (!ref) {
                continue;
            }

            if (isFunction(ref)) {
                ref(element);
            } else {
                ref.current = element;
            }
        }
    }, refs);

    return callback;
};
