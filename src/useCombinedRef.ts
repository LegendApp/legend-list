import { useCallback } from "react";

type RefItem<T> = ((element: T | null) => void) | React.MutableRefObject<T | null> | null | undefined;

export const useCombinedRef = <T>(...refs: RefItem<T>[]) => {
    const callback = useCallback((element: T | null) => {
        for (const ref of refs) {
            if (!ref) {
                continue;
            }

            if (typeof ref === "function") {
                ref(element);
            } else {
                ref.current = element;
            }
        }
    }, refs);

    return callback;
};
