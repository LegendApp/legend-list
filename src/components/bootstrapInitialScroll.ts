export type InitialScrollStrategy = "legacy" | "bootstrapReveal";

// Flip this constant while validating the new implementation.
export const INITIAL_SCROLL_STRATEGY: InitialScrollStrategy = "bootstrapReveal";
let testInitialScrollStrategyOverride: InitialScrollStrategy | undefined;

export const DEFAULT_BOOTSTRAP_REVEAL_EPSILON = 1;
export const DEFAULT_BOOTSTRAP_REVEAL_MAX_FRAMES = 8;
export const DEFAULT_BOOTSTRAP_REVEAL_MAX_PASSES = 24;
export const DEFAULT_BOOTSTRAP_REVEAL_STABLE_PASSES = 2;

export type BootstrapRevealSnapshot = {
    anchorOffset: number;
    visibleIndices: readonly number[];
};

export function getBootstrapRevealVisibleIndices(options: {
    dataLength: number;
    getSize: (index: number) => number | undefined;
    offset: number;
    positions: Array<number | undefined>;
    scrollLength: number;
}) {
    const { dataLength, getSize, offset, positions, scrollLength } = options;
    const endOffset = offset + scrollLength;
    const visibleIndices: number[] = [];

    for (let index = 0; index < dataLength; index++) {
        const position = positions[index];
        if (position === undefined) {
            continue;
        }

        const size = getSize(index);
        if (size === undefined) {
            continue;
        }

        if (position < endOffset && position + size > offset) {
            visibleIndices.push(index);
        } else if (visibleIndices.length > 0 && position >= endOffset) {
            break;
        }
    }

    return visibleIndices;
}

export function areBootstrapRevealVisibleIndicesMeasured(options: {
    getIsMeasured: (index: number) => boolean;
    visibleIndices: readonly number[];
}) {
    const { getIsMeasured, visibleIndices } = options;
    return visibleIndices.length > 0 && visibleIndices.every((index) => getIsMeasured(index));
}

export function getInitialScrollStrategy() {
    return testInitialScrollStrategyOverride ?? INITIAL_SCROLL_STRATEGY;
}

export function setInitialScrollStrategyForTests(strategy: InitialScrollStrategy | undefined) {
    testInitialScrollStrategyOverride = strategy;
}

export function resolveInitialScrollStrategy(options: {
    globalStrategy?: InitialScrollStrategy;
    hasInitialScrollIndex: boolean;
    hasInitialScrollOffset: boolean;
    initialScrollAtEnd: boolean;
}): InitialScrollStrategy {
    const {
        globalStrategy = getInitialScrollStrategy(),
        hasInitialScrollIndex,
        hasInitialScrollOffset,
        initialScrollAtEnd,
    } = options;

    if (!initialScrollAtEnd && !hasInitialScrollIndex) {
        return "legacy";
    }

    return hasInitialScrollOffset && !initialScrollAtEnd && !hasInitialScrollIndex ? "legacy" : globalStrategy;
}

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
