export type BaseSharedValue<T = number> = {
    get: () => T;
};

export type StylesAsSharedValue<Style> = {
    [key in keyof Style]: Style[key] | BaseSharedValue<Style[key]>;
};

export interface DoScrollToParams {
    animated?: boolean;
    horizontal?: boolean;
    isInitialScroll?: boolean;
    offset: number;
}
