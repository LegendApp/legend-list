
import React, { type PropsWithChildren, type ReactNode, createContext, useContext } from 'react'

type RenderItemFunction = (key: string, containerId: number) => ReactNode;

interface RenderItemContextProps {
    renderItem: RenderItemFunction;
}

const RenderItemContext = createContext<RenderItemContextProps | undefined>(undefined);

export const RenderItemProvider = ({ renderItem, children }: PropsWithChildren<{renderItem: RenderItemFunction }>) => {
    const child = React.Children.only(children);
    return (
        <RenderItemContext.Provider value={{ renderItem }}>
            {child}
        </RenderItemContext.Provider>
    );
};

export const useRenderItem = (): RenderItemFunction => {
    const context = useContext(RenderItemContext);
    if (!context) {
        throw new Error('useRenderItem must be used within a RenderItemProvider');
    }
    return context.renderItem;
};