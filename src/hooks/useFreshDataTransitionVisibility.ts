import { useLayoutEffect, useRef } from "react";

export function useFreshDataTransitionVisibility(readyToRender: boolean, transitionEpoch: number) {
    const completedTransitionEpoch = useRef(transitionEpoch);
    const isTransitionPending = completedTransitionEpoch.current !== transitionEpoch;

    useLayoutEffect(() => {
        if (!readyToRender) {
            completedTransitionEpoch.current = transitionEpoch;
        }
    }, [readyToRender, transitionEpoch]);

    return readyToRender && !isTransitionPending;
}
