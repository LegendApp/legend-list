import { Platform } from "react-native";

import { IsNewArchitecture } from "@/constants";
import { scrollToIndex } from "@/core/scrollToIndex";
import { type StateContext, set$ } from "@/state/state";
import type { InternalState } from "@/types";
import { checkAtBottom } from "@/utils/checkAtBottom";

export function setDidLayout(ctx: StateContext, state: InternalState) {
    const {
        loadStartTime,
        initialScroll,
        props: { onLoad },
    } = state;
    state.queuedInitialLayout = true;
    checkAtBottom(ctx, state);

    const setIt = () => {
        set$(ctx, "containersDidLayout", true);

        if (onLoad) {
            onLoad({ elapsedTimeInMs: Date.now() - loadStartTime });
        }
    };

    if (Platform.OS === "android" && initialScroll) {
        if (IsNewArchitecture) {
            // Android new arch sometimes doesn't scroll to the initial index correctly
            // TODO: Can we find a way to remove all this?
            scrollToIndex(ctx, state, { ...initialScroll, animated: false });
            requestAnimationFrame(() => {
                scrollToIndex(ctx, state, { ...initialScroll, animated: false });

                setIt();
            });
        } else {
            // This improves accuracy on Android old arch
            scrollToIndex(ctx, state, { ...initialScroll, animated: false });
            setIt();
        }
    } else {
        setIt();
    }
}
