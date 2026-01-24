import type { InternalState } from "@/types";

export function getContentInsetEnd(state: InternalState) {
    const { props } = state;
    const horizontal = props.horizontal;
    let contentInset = props.contentInset;

    if (!contentInset) {
        const animatedInset = props.animatedProps?.contentInset;

        if (animatedInset) {
            if ("get" in animatedInset) {
                contentInset = animatedInset.get();
            } else {
                contentInset = animatedInset;
            }
        }
    }

    const baseInset = contentInset ?? state.nativeContentInset;
    const overrideInset = state.contentInsetOverride ?? undefined;
    if (overrideInset) {
        const mergedInset = { top: 0, left: 0, right: 0, bottom: 0, ...baseInset, ...overrideInset };
        return (horizontal ? mergedInset.right : mergedInset.bottom) || 0;
    }

    if (baseInset) {
        return (horizontal ? baseInset.right : baseInset.bottom) || 0;
    }

    return 0;
}
