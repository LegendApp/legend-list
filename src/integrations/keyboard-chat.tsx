import type * as React from "react";
import { type ForwardedRef, useCallback, useEffect, useMemo } from "react";
import type { ScrollViewProps } from "react-native";
import { KeyboardChatScrollView, type KeyboardChatScrollViewProps } from "react-native-keyboard-controller";
import { useSharedValue } from "react-native-reanimated";

import type { LegendListRef } from "@legendapp/list/react-native";
import { AnimatedLegendList, type AnimatedLegendListProps } from "@legendapp/list/reanimated";
import type { AnchoredEndSpaceConfig } from "@/types.base";
import { typedForwardRef } from "@/types.internal";

type KeyboardChatScrollViewPropsUnique = Omit<
    KeyboardChatScrollViewProps,
    keyof ScrollViewProps | "inverted" | "ScrollViewComponent" | "blankSpace"
>;

type KeyboardChatLegendListProps<ItemT> = Omit<
    AnimatedLegendListProps<ItemT>,
    "anchoredEndSpace" | "renderScrollComponent"
> &
    KeyboardChatScrollViewPropsUnique & {
        anchoredEndSpace?: AnchoredEndSpaceConfig;
    };

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const KeyboardChatLegendList = typedForwardRef(function KeyboardChatLegendList<ItemT>(
    props: KeyboardChatLegendListProps<ItemT>,
    forwardedRef: ForwardedRef<LegendListRef>,
) {
    const {
        anchoredEndSpace,
        applyWorkaroundForContentInsetHitTestBug,
        extraContentPadding,
        freeze,
        keyboardLiftBehavior,
        offset,
        ...rest
    } = props;

    const blankSpace = useSharedValue<number>(0);

    useEffect(() => {
        if (!anchoredEndSpace) {
            blankSpace.value = 0;
        }
    }, [anchoredEndSpace, blankSpace]);

    const anchoredEndSpaceWithBlankSpace = useMemo(() => {
        if (!anchoredEndSpace) {
            return undefined;
        }

        return {
            ...anchoredEndSpace,
            includeInEndInset: true,
            onSizeChanged: (size: number) => {
                blankSpace.value = size;
                anchoredEndSpace.onSizeChanged?.(size);
            },
        };
    }, [anchoredEndSpace, blankSpace]);

    const memoList = useCallback(
        (scrollProps: ScrollViewProps) => {
            return (
                <KeyboardChatScrollView
                    {...scrollProps}
                    applyWorkaroundForContentInsetHitTestBug={applyWorkaroundForContentInsetHitTestBug}
                    blankSpace={blankSpace}
                    extraContentPadding={extraContentPadding}
                    freeze={freeze}
                    keyboardLiftBehavior={keyboardLiftBehavior}
                    offset={offset}
                />
            );
        },
        [
            applyWorkaroundForContentInsetHitTestBug,
            blankSpace,
            extraContentPadding,
            freeze,
            keyboardLiftBehavior,
            offset,
        ],
    );

    const AnimatedLegendListInternal = AnimatedLegendList as unknown as React.ComponentType<
        AnimatedLegendListProps<ItemT> & {
            anchoredEndSpace?: AnchoredEndSpaceConfig;
            ref?: ForwardedRef<LegendListRef>;
        }
    >;

    return (
        <AnimatedLegendListInternal
            anchoredEndSpace={anchoredEndSpaceWithBlankSpace}
            ref={forwardedRef}
            renderScrollComponent={memoList}
            {...rest}
        />
    );
});
