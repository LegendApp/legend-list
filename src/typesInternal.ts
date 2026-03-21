export type BaseSharedValue<T = number> = {
    get: () => T;
};

export type StylesAsSharedValue<Style> = {
    [key in keyof Style]: Style[key] | BaseSharedValue<Style[key]>;
};

export interface InitialBootstrapState {
    active: boolean;
    desiredOffset?: number;
    stableFrames: number;
    targetIndexHint?: number;
    targetKey?: string;
    viewOffset?: number;
    viewPosition?: number;
}
