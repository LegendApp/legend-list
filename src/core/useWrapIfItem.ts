import { useMemo } from "react";

// biome-ignore lint/complexity/noBannedTypes: It's fine
export function useWrapIfItem<T extends Function>(fn: T | undefined) {
    return useMemo(
        () =>
            fn
                ? (arg1: any, arg2: any, arg3?: any) =>
                      arg1 !== undefined && arg2 !== undefined ? fn(arg1, arg2, arg3) : undefined
                : undefined,
        [fn],
    );
}
