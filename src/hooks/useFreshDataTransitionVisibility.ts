import { useLayoutEffect, useRef, useState } from "react";

import { Platform } from "@/platform/Platform";

export function useFreshDataTransitionVisibility(readyToRender: boolean, transitionEpoch: number) {
    const [completedTransitionEpoch, setCompletedTransitionEpoch] = useState(transitionEpoch);
    const hasPresentedContent = useRef(false);
    const isTransitionPending = completedTransitionEpoch !== transitionEpoch;

    // Completing in an effect rather than on an observed `readyToRender === false` render keeps
    // the pending flag from outliving the transition. The readiness reset and the layout that
    // restores it can land in the same layout-effect pass, in which case this never renders in
    // the not-ready state and a flag that waited for it would stay pending forever.
    useLayoutEffect(() => {
        if (readyToRender) hasPresentedContent.current = true;
        setCompletedTransitionEpoch(transitionEpoch);
    }, [readyToRender, transitionEpoch]);

    // Web layout effects place the incoming rows before paint. Keep the mounted layer
    // visible while bootstrap converges instead of blanking an already presented list.
    return Platform.OS === "web" ? readyToRender || hasPresentedContent.current : readyToRender && !isTransitionPending;
}
