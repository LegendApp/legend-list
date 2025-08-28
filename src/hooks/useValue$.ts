import type { ListenerType, ListenerTypeValueMap } from "@/state/state";
import { useArr$ } from "@/state/state";

export function useValue$<T extends ListenerType, T2 = ListenerTypeValueMap[T]>(
    key: T,
    params?: {
        getValue?: (value: number) => T2;
        delay?: number | ((value: number, prevValue: number | undefined) => number);
    },
): T2 {
    const [value] = useArr$([key]);
    return value;
}
