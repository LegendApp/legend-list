import type { ViewStyle } from "react-native";

import type { ColumnWrapperStyle } from "@/types";

export function createColumnWrapperStyle(contentContainerStyle: ViewStyle): ColumnWrapperStyle | undefined {
    const { gap, columnGap, rowGap } = contentContainerStyle;
    if (gap || columnGap || rowGap) {
        contentContainerStyle.gap = undefined;
        contentContainerStyle.columnGap = undefined;
        contentContainerStyle.rowGap = undefined;
        return {
            columnGap: columnGap as number,
            gap: gap as number,
            rowGap: rowGap as number,
        };
    }
}
