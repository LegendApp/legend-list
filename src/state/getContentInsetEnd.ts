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

    return (horizontal ? contentInset?.right : contentInset?.bottom) || 0;
}
