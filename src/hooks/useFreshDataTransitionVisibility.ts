import { useLayoutEffect, useState } from "react";

export function useFreshDataTransitionVisibility(readyToRender: boolean, transitionEpoch: number) {
    const [completedTransitionEpoch, setCompletedTransitionEpoch] = useState(transitionEpoch);
    const isTransitionPending = completedTransitionEpoch !== transitionEpoch;

    // Completing in an effect rather than on an observed `readyToRender === false` render keeps
    // the pending flag from outliving the transition. The readiness reset and the layout that
    // restores it can land in the same layout-effect pass, in which case this never renders in
    // the not-ready state and a flag that waited for it would stay pending forever.
    useLayoutEffect(() => {
        setCompletedTransitionEpoch(transitionEpoch);
    }, [transitionEpoch]);

    return readyToRender && !isTransitionPending;
}
