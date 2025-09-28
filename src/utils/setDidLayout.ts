import { Platform } from "react-native";

import { IsNewArchitecture } from "@/constants";
import { scrollTo } from "@/core/scrollTo";
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

    console.log("setDidLayout");

    if (Platform.OS === "android" || !IsNewArchitecture) {
        // TODO: This seems to be not 100% accurate on Android or iOS old arch
        if (initialScroll) {
            // scrollTo(state, { ...initialScroll, animated: false, offset: state.scroll || 0 });
            scrollToIndex(ctx, state, { ...initialScroll, animated: false });
            queueMicrotask(() => {
                scrollToIndex(ctx, state, { ...initialScroll, animated: false });
                requestAnimationFrame(() => {
                    // Android sometimes doesn't scroll to the initial index correctly
                    scrollToIndex(ctx, state, { ...initialScroll, animated: false });

                    setIt();
                });
            });
        } else {
            queueMicrotask(setIt);
        }
    } else {
        setIt();
    }
}
