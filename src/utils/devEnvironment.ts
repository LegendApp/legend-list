declare const __DEV__: boolean;

const metroDev = typeof __DEV__ !== "undefined" ? __DEV__ : undefined;

const envMode =
    typeof process !== "undefined" && typeof process.env === "object" && process.env
        ? (process.env.NODE_ENV ?? process.env.MODE)
        : undefined;

const processDev = typeof envMode === "string" ? envMode.toLowerCase() !== "production" : undefined;

export const IS_DEV = metroDev ?? processDev ?? false;
