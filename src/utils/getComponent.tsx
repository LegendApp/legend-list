import * as React from "react";

/**
 * Gets a component from a React component type or React element.
 * @param Component - The component to get.
 * @returns The component, or null if the component is not valid.
 */
export const getComponent = (Component: React.ComponentType<any> | React.ReactElement) => {
    if (React.isValidElement<any>(Component)) {
        return Component;
    }
    if (Component) {
        return <Component />;
    }
    return null;
};
