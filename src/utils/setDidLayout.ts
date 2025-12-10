import { IsNewArchitecture } from "@/constants-platform";
import { scrollToIndex } from "@/core/scrollToIndex";
import { Platform } from "@/platform/Platform";
import { type StateContext, set$ } from "@/state/state";
import { checkAtBottom } from "@/utils/checkAtBottom";

export function setDidLayout(ctx: StateContext) {
    const state = ctx.state;
    const {
        loadStartTime,
        initialScroll,
        props: { onLoad },
    } = state;
    state.queuedInitialLayout = true;
    checkAtBottom(ctx);

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
            scrollToIndex(ctx, { ...initialScroll, animated: false });
            requestAnimationFrame(() => {
                scrollToIndex(ctx, { ...initialScroll, animated: false });

                setIt();
            });
        } else {
            // This improves accuracy on Android old arch
            scrollToIndex(ctx, { ...initialScroll, animated: false });
            setIt();
        }
    } else {
        setIt();
    }
}
