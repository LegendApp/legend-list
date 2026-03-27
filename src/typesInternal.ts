export type BaseSharedValue<T = number> = {
    get: () => T;
};

export type StylesAsSharedValue<Style> = {
    [key in keyof Style]: Style[key] | BaseSharedValue<Style[key]>;
};

export type InitialBootstrapPhase = "inactive" | "projecting" | "committing";

export interface InitialBootstrapTarget {
    desiredOffset?: number;
    indexHint?: number;
    key?: string;
    viewOffset: number;
    viewPosition: number;
}

export interface InitialBootstrapState {
    commitStableFrames: number;
    commitTargetOffset?: number;
    expectsObservedPlatformSettle: boolean;
    phase: InitialBootstrapPhase;
    projectionOffset: number;
    didObservePlatformScroll?: boolean;
    observedPlatformScrollOffset?: number;
    observedPlatformScrollStableFrames?: number;
    previousObservedPlatformScrollOffset?: number;
    stableFrames: number;
    target: InitialBootstrapTarget;
}
