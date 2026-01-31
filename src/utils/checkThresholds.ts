import type { StateContext } from "@/state/state";
import { checkAtBottom } from "@/utils/checkAtBottom";
import { checkAtTop } from "@/utils/checkAtTop";

export function checkThresholds(ctx: StateContext) {
    checkAtBottom(ctx);
    checkAtTop(ctx);
}
