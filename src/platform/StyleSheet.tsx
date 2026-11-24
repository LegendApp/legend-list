// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";

import { isArray } from "@/utils/helpers";

function flattenStyles<T>(styles: T | T[]): T {
    if (isArray(styles)) {
        return Object.assign({}, ...styles.filter(Boolean));
    }
    return styles;
}

// React Native's axis shorthands are not CSS properties, so the browser would ignore them on a div.
// Writes them out per side; a side that is set on its own wins over its axis, as in React Native.
function expandAxisShorthands(style: any): any {
    if (!style) {
        return style;
    }
    const { marginHorizontal, marginVertical, paddingHorizontal, paddingVertical, ...rest } = style;
    const axes = [
        [marginHorizontal, "marginLeft", "marginRight"],
        [marginVertical, "marginTop", "marginBottom"],
        [paddingHorizontal, "paddingLeft", "paddingRight"],
        [paddingVertical, "paddingTop", "paddingBottom"],
    ] as const;
    if (axes.every(([value]) => value == null)) {
        return style;
    }
    for (const [value, start, end] of axes) {
        if (value != null) {
            rest[start] = style[start] ?? value;
            rest[end] = style[end] ?? value;
        }
    }
    return rest;
}

export const StyleSheet = {
    create: <T extends Record<string, any>>(styles: T): T => styles,
    flatten: (style: any): any => expandAxisShorthands(flattenStyles(style)),
};
