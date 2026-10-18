// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";

import { isArray } from "@/utils/helpers";

// Style arrays can nest like React Native's (e.g. [styles.list, props.style] where props.style is
// itself an array), so flatten recursively; spreading a nested array would add numeric keys that the
// DOM rejects when React assigns the style.
function flattenStyles<T>(styles: T | T[]): T {
    if (isArray(styles)) {
        return Object.assign({}, ...styles.filter(Boolean).map(flattenStyles));
    }
    return styles;
}
export const StyleSheet = {
    create: <T extends Record<string, any>>(styles: T): T => styles,
    flatten: (style: any): any => flattenStyles(style),
};
