export type InitialScrollStrategy = "legacy" | "bootstrapReveal";

// Flip this constant while validating the new implementation.
export const INITIAL_SCROLL_STRATEGY: InitialScrollStrategy = "legacy";

export const DEFAULT_BOOTSTRAP_REVEAL_EPSILON = 1;
export const DEFAULT_BOOTSTRAP_REVEAL_MAX_FRAMES = 8;
export const DEFAULT_BOOTSTRAP_REVEAL_MAX_PASSES = 24;
export const DEFAULT_BOOTSTRAP_REVEAL_STABLE_PASSES = 2;

export type BootstrapRevealSnapshot = {
    anchorOffset: number;
    visibleIndices: readonly number[];
};

export function areBootstrapRevealSnapshotsEqual(
    previous: BootstrapRevealSnapshot | undefined,
    next: BootstrapRevealSnapshot | undefined,
    epsilon = DEFAULT_BOOTSTRAP_REVEAL_EPSILON,
) {
    if (!previous || !next) {
        return false;
    }

    if (Math.abs(previous.anchorOffset - next.anchorOffset) > epsilon) {
        return false;
    }

    if (previous.visibleIndices.length !== next.visibleIndices.length) {
        return false;
    }

    for (let i = 0; i < previous.visibleIndices.length; i++) {
        if (previous.visibleIndices[i] !== next.visibleIndices[i]) {
            return false;
        }
    }

    return true;
}

export function getBootstrapRevealStablePassCount(options: {
    next: BootstrapRevealSnapshot | undefined;
    previous: BootstrapRevealSnapshot | undefined;
    stablePassCount: number;
}) {
    const { next, previous, stablePassCount } = options;
    return areBootstrapRevealSnapshotsEqual(previous, next) ? stablePassCount + 1 : 1;
}

export function shouldAbortBootstrapReveal(options: {
    frameCount: number;
    maxFrames?: number;
    maxPasses?: number;
    passCount: number;
}) {
    const {
        frameCount,
        maxFrames = DEFAULT_BOOTSTRAP_REVEAL_MAX_FRAMES,
        maxPasses = DEFAULT_BOOTSTRAP_REVEAL_MAX_PASSES,
        passCount,
    } = options;
    return frameCount >= maxFrames || passCount >= maxPasses;
}
