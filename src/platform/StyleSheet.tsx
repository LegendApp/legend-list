// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";

function flattenStyles<T>(styles: T | T[]): T {
    if (Array.isArray(styles)) {
        return Object.assign({}, ...styles.filter(Boolean));
    }
    return styles;
}
export const StyleSheet = {
    create: <T extends Record<string, any>>(styles: T): T => styles,
    flatten: (style: any): any => flattenStyles(style),
};
