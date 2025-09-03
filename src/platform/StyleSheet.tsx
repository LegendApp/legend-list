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
