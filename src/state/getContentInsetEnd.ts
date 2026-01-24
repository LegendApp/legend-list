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

    if (!contentInset) {
        const nativeContentInset = state.nativeContentInset;
        if (nativeContentInset) {
            return (horizontal ? nativeContentInset.right : nativeContentInset.bottom) || 0;
        }
    }

    return (horizontal ? contentInset?.right : contentInset?.bottom) || 0;
}
