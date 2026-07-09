import { Platform } from "@/platform/Platform";
import { peek$, type StateContext, set$ } from "@/state/state";
import type { AdaptiveRender, AdaptiveRenderChangeReason } from "@/types.base";

export const DEFAULT_ADAPTIVE_RENDER_ENTER_VELOCITY = 3;
export const DEFAULT_ADAPTIVE_RENDER_EXIT_VELOCITY = 1;
export const DEFAULT_ADAPTIVE_RENDER_EXIT_DELAY = 250;
export const DEFAULT_WEB_ADAPTIVE_RENDER_ENTER_VELOCITY = 6;
export const DEFAULT_WEB_ADAPTIVE_RENDER_EXIT_VELOCITY = 3;
export const DEFAULT_WEB_ADAPTIVE_RENDER_EXIT_DELAY = 250;

function clearAdaptiveRenderExitTimeout(ctx: StateContext) {
    const state = ctx.state;
    const previousTimeout = state.timeoutAdaptiveRender;
    if (previousTimeout !== undefined) {
        clearTimeout(previousTimeout);
        state.timeouts.delete(previousTimeout);
        state.timeoutAdaptiveRender = undefined;
    }
}

function scheduleAdaptiveRenderExit(ctx: StateContext, exitDelay: number) {
    const state = ctx.state;
    clearAdaptiveRenderExitTimeout(ctx);
    if (exitDelay <= 0) {
        setAdaptiveRender(ctx, "normal", "scroll");
    } else {
        const timeout: any = setTimeout(() => {
            state.timeouts.delete(timeout);
            state.timeoutAdaptiveRender = undefined;
            setAdaptiveRender(ctx, "normal", "scroll");
        }, exitDelay);
        state.timeoutAdaptiveRender = timeout;
        state.timeouts.add(timeout);
    }
}

export function setAdaptiveRender(ctx: StateContext, mode: AdaptiveRender, reason: AdaptiveRenderChangeReason) {
    const previousMode = peek$(ctx, "adaptiveRender");
    if (previousMode !== mode) {
        set$(ctx, "adaptiveRender", mode);
        ctx.state.props.adaptiveRender?.onChange?.(mode, reason);
    }
}

export function resetAdaptiveRender(ctx: StateContext) {
    clearAdaptiveRenderExitTimeout(ctx);
    const mode = ctx.state.props.adaptiveRender?.initialMode ?? "normal";
    if (peek$(ctx, "adaptiveRender") !== mode) {
        setAdaptiveRender(ctx, mode, "initial");
    }
}

export function updateAdaptiveRender(ctx: StateContext, scrollVelocity: number, options?: { forceLight?: boolean }) {
    const state = ctx.state;
    const adaptiveRender = state.props.adaptiveRender;
    const currentMode = peek$(ctx, "adaptiveRender");

    if (peek$(ctx, "readyToRender")) {
        if (adaptiveRender) {
            const isWeb = Platform.OS === "web";
            const enterVelocity =
                adaptiveRender.enterVelocity ??
                (isWeb ? DEFAULT_WEB_ADAPTIVE_RENDER_ENTER_VELOCITY : DEFAULT_ADAPTIVE_RENDER_ENTER_VELOCITY);
            const exitVelocity =
                adaptiveRender.exitVelocity ??
                (isWeb ? DEFAULT_WEB_ADAPTIVE_RENDER_EXIT_VELOCITY : DEFAULT_ADAPTIVE_RENDER_EXIT_VELOCITY);
            const exitDelay =
                adaptiveRender.exitDelay ??
                (isWeb ? DEFAULT_WEB_ADAPTIVE_RENDER_EXIT_DELAY : DEFAULT_ADAPTIVE_RENDER_EXIT_DELAY);
            const threshold = currentMode === "light" ? exitVelocity : enterVelocity;
            const nextMode = options?.forceLight || Math.abs(scrollVelocity) > threshold ? "light" : "normal";
            const previousMode = state.timeoutAdaptiveRender !== undefined ? "normal" : currentMode;

            if (nextMode !== previousMode) {
                if (nextMode === "light") {
                    setAdaptiveRender(ctx, "light", "scroll");
                    scheduleAdaptiveRenderExit(ctx, exitDelay);
                } else if (currentMode === "light") {
                    scheduleAdaptiveRenderExit(ctx, exitDelay);
                }
            }
        } else {
            resetAdaptiveRender(ctx);
        }
    }
}
