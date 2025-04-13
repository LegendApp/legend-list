import type { LegendList as LegendListBase, LegendListProps, LegendListRef } from "@legendapp/list";
import type { AnimatedLegendList } from "@legendapp/list/animated";
import type { AnimatedLegendList as ReanimatedLegendList } from "@legendapp/list/reanimated";
// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { type ForwardedRef, forwardRef, useState } from "react";
import { useKeyboardHandler } from "react-native-keyboard-controller";
import { runOnJS } from "react-native-reanimated";

// biome-ignore lint/complexity/noBannedTypes: This is a workaround for the fact that forwardRef is not typed
type TypedForwardRef = <T, P = {}>(
    render: (props: P, ref: React.Ref<T>) => React.ReactNode,
) => (props: P & React.RefAttributes<T>) => React.ReactNode;

const typedForwardRef = forwardRef as TypedForwardRef;

export const LegendList = typedForwardRef(function LegendList<
    ItemT,
    ListT extends
        | typeof LegendListBase
        | typeof AnimatedLegendList
        | typeof ReanimatedLegendList = typeof LegendListBase,
>(props: LegendListProps<ItemT> & { LegendList?: ListT }, forwardedRef: ForwardedRef<LegendListRef>) {
    const { LegendList: LegendListProp, ...rest } = props;
    const [padding, setPadding] = useState(0);

    // Define this function outside the worklet
    const updatePadding = (height: number) => {
        setPadding(height);
    };

    useKeyboardHandler({
        onEnd: (e) => {
            "worklet";
            runOnJS(updatePadding)(e.height);
        },
    });

    const LegendListComponent = LegendListProp ?? LegendList;

    // @ts-expect-error TODO: Fix this
    return <LegendListComponent style={{ paddingTop: padding }} {...rest} ref={forwardedRef as any} />;
});
