import * as React from "react";

import { useLatestRef } from "@/hooks/useLatestRef";

export function useStableRenderComponent<Props extends object, RenderProps, Ref>(
    renderComponent: ((props: RenderProps) => React.ReactElement | null) | undefined,
    mapProps: (props: Props, ref: React.Ref<Ref>) => RenderProps,
): React.ForwardRefExoticComponent<React.PropsWithoutRef<Props> & React.RefAttributes<Ref>> {
    const renderComponentRef = useLatestRef(renderComponent);
    const mapPropsRef = useLatestRef(mapProps);

    return React.useMemo(
        () =>
            React.forwardRef<Ref, Props>(
                (props, ref) => renderComponentRef.current?.(mapPropsRef.current(props as Props, ref)) ?? null,
            ),
        [mapPropsRef, renderComponentRef],
    );
}
