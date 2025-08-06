// Web layout utilities using ResizeObserver and getBoundingClientRect

export interface LayoutRectangle {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface LayoutChangeEvent {
    nativeEvent: {
        layout: LayoutRectangle;
    };
}

export const Dimensions = {
    get: (key: "window" | "screen") => {
        if (typeof window === "undefined") {
            return { width: 0, height: 0 };
        }
        
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            scale: window.devicePixelRatio || 1,
            fontScale: 1,
        };
    },
    addEventListener: (type: string, handler: Function) => {
        if (type === "change" && typeof window !== "undefined") {
            window.addEventListener("resize", handler as EventListener);
            return {
                remove: () => window.removeEventListener("resize", handler as EventListener),
            };
        }
        return { remove: () => {} };
    },
};

export const StyleSheet = {
    create: <T extends Record<string, any>>(styles: T): T => styles,
    flatten: (style: any): any => {
        if (!style) return {};
        if (Array.isArray(style)) {
            return Object.assign({}, ...style.filter(Boolean));
        }
        return style;
    },
    absoluteFillObject: {
        position: "absolute" as const,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
    },
    absoluteFill: {
        position: "absolute" as const,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
    },
};