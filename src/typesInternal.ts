export type BaseSharedValue<T = number> = {
    get: () => T;
};

export type StylesAsSharedValue<Style> = {
    [key in keyof Style]: Style[key] | BaseSharedValue<Style[key]>;
};
