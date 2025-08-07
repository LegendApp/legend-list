import type { ListenerType } from "@/state/state";
import { useArr$ } from "@/state/state";

export function useValue$(
    key: ListenerType,
    params?: {
        getValue?: (value: number) => number;
        delay?: number | ((value: number, prevValue: number | undefined) => number);
    },
) {
    const { getValue } = params || {};
    const [value] = useArr$([key]);
    return getValue ? getValue(value) : value;
}
