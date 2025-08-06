import * as React from "react";
import type { CSSProperties } from "react";

export interface TextStyle extends CSSProperties {
    // Text-specific style properties
}

export interface TextProps {
    children?: React.ReactNode;
    style?: TextStyle | TextStyle[];
    testID?: string;
    accessibilityLabel?: string;
    numberOfLines?: number;
    ellipsizeMode?: "head" | "middle" | "tail" | "clip";
}

const convertStyleArray = (style: TextStyle | TextStyle[] | undefined): CSSProperties => {
    if (!style) return {};
    if (Array.isArray(style)) {
        return Object.assign({}, ...style.filter(Boolean));
    }
    return style;
};

export const Text = React.forwardRef<HTMLSpanElement, TextProps>(({ 
    children, 
    style, 
    testID,
    accessibilityLabel,
    numberOfLines,
    ellipsizeMode = "tail",
    ...props 
}, ref) => {
    const combinedStyle: CSSProperties = {
        ...convertStyleArray(style),
    };

    // Handle numberOfLines
    if (numberOfLines && numberOfLines > 0) {
        combinedStyle.display = "-webkit-box";
        combinedStyle.WebkitLineClamp = numberOfLines;
        combinedStyle.WebkitBoxOrient = "vertical";
        combinedStyle.overflow = "hidden";
        
        // Handle ellipsizeMode
        if (ellipsizeMode === "clip") {
            combinedStyle.textOverflow = "clip";
        } else {
            combinedStyle.textOverflow = "ellipsis";
        }
    }

    return (
        <span
            ref={ref}
            style={combinedStyle}
            data-testid={testID}
            aria-label={accessibilityLabel}
            {...props}
        >
            {children}
        </span>
    );
});

Text.displayName = "Text";