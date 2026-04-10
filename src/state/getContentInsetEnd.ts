import type { InternalState } from "@/types.internal";

export function getContentInsetEnd(state: InternalState) {
    const { props } = state;
    const horizontal = props.horizontal;
    const contentInset = props.contentInset;
    const baseInset = contentInset ?? state.nativeContentInset;
    const baseEndInset = (horizontal ? baseInset?.right : baseInset?.bottom) || 0;
    const anchoredEndInset =
        props.anchoredEndSpace?.includeInEndInset && state.anchoredEndSpaceSize ? state.anchoredEndSpaceSize : 0;

    const overrideInset = state.contentInsetOverride ?? undefined;
    if (overrideInset) {
        const mergedInset = { bottom: 0, left: 0, right: 0, top: 0, ...baseInset, ...overrideInset };
        return Math.max((horizontal ? mergedInset.right : mergedInset.bottom) || 0, anchoredEndInset);
    }

    return Math.max(baseEndInset, anchoredEndInset);
}
