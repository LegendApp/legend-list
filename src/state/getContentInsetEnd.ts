import type { InternalState } from "@/types.internal";

export function getContentInsetEnd(state: InternalState) {
    const { props } = state;
    const horizontal = props.horizontal;
    const contentInset = props.contentInset;
    const baseInset = contentInset ?? state.nativeContentInset;

    const overrideInset = state.contentInsetOverride ?? undefined;
    if (overrideInset) {
        const mergedInset = { bottom: 0, left: 0, right: 0, top: 0, ...baseInset, ...overrideInset };
        return (horizontal ? mergedInset.right : mergedInset.bottom) || 0;
    }

    if (baseInset) {
        return (horizontal ? baseInset.right : baseInset.bottom) || 0;
    }

    return 0;
}
