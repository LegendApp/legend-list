import type { StateContext } from "@/state/state";
import { isInMVCPActiveMode } from "@/utils/isInMVCPActiveMode";

export function shouldForceWebLayoutResync(state: StateContext["state"]) {
    return isInMVCPActiveMode(state) && !state.scrollingTo;
}
