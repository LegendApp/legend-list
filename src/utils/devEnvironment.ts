declare const __DEV__: boolean;

const metroDev = typeof __DEV__ !== "undefined" ? __DEV__ : undefined;

const importMetaEnv =
    typeof import.meta !== "undefined" && typeof import.meta === "object"
        ? ((import.meta as { env?: { DEV?: unknown; MODE?: unknown } }).env ?? undefined)
        : undefined;

const importMetaDev =
    importMetaEnv && typeof importMetaEnv.DEV === "boolean"
        ? importMetaEnv.DEV
        : importMetaEnv && typeof importMetaEnv.MODE === "string"
          ? importMetaEnv.MODE.toLowerCase() !== "production"
          : undefined;

const envMode =
    typeof process !== "undefined" && typeof process.env === "object" && process.env
        ? (process.env.NODE_ENV ?? process.env.MODE)
        : undefined;

const processDev =
    typeof envMode === "string" ? envMode.toLowerCase() !== "production" : undefined;

export const IS_DEV =
    metroDev ??
    importMetaDev ??
    processDev ??
    false;
