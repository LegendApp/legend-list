export interface NativeScrollEvent {
    contentOffset: { x: number; y: number };
    contentSize: { width: number; height: number };
    layoutMeasurement: { width: number; height: number };
    contentInset: { top: number; left: number; bottom: number; right: number };
    zoomScale: number;
}

export interface NativeSyntheticEvent<T> {
    nativeEvent: T;
}

export interface LayoutChangeEvent {
    nativeEvent: {
        layout: LayoutRectangle;
    };
}

export interface LayoutRectangle {
    x: number;
    y: number;
    width: number;
    height: number;
}

export const StyleSheet = {
    create: <T extends Record<string, any>>(styles: T): T => styles,
    flatten: (style: any): any => style,
};
