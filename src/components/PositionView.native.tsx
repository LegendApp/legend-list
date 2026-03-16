import * as React from "react";
import { Animated, type LayoutChangeEvent, Platform, type StyleProp, View, type ViewStyle } from "react-native";

import { POSITION_OUT_OF_VIEW } from "@/constants";
import { useValue$ } from "@/hooks/useValue$";
import { useArr$ } from "@/state/state";
import { type StickyHeaderConfig, typedMemo } from "@/types";
import { IS_DEV } from "@/utils/devEnvironment";
import { getComponent } from "@/utils/getComponent";

type PositionViewDebugEntry = {
    component: "animated" | "state" | "sticky";
    containerId: number;
    horizontal: boolean;
    index: number | undefined;
    itemKey: string | undefined;
    position: number;
};

let pendingPositionViewCommits: PositionViewDebugEntry[] = [];
let positionViewCommitSequence = 0;
let positionViewCommitRaf: number | undefined;
const mountedPositionViews = new Map<number, PositionViewDebugEntry>();

function schedulePositionViewCommitFlush() {
    if (!IS_DEV || positionViewCommitRaf !== undefined) {
        return;
    }

    positionViewCommitRaf = requestAnimationFrame(() => {
        positionViewCommitRaf = undefined;
        if (pendingPositionViewCommits.length === 0) {
            return;
        }

        const commits = pendingPositionViewCommits;
        pendingPositionViewCommits = [];
        positionViewCommitSequence += 1;

        const committedItemKeys = [
            ...new Set(
                commits.map((entry) => entry.itemKey).filter((itemKey): itemKey is string => itemKey !== undefined),
            ),
        ];
        const mountedEntries = [...mountedPositionViews.values()]
            .sort((left, right) => left.containerId - right.containerId)
            .map((entry) => ({
                component: entry.component,
                containerId: entry.containerId,
                index: entry.index,
                itemKey: entry.itemKey,
                position: entry.position,
            }));

        console.log("[legend-list][position-view-commit]", {
            commitCount: commits.length,
            commits,
            committedItemCount: committedItemKeys.length,
            committedItemKeys,
            mountedCount: mountedEntries.length,
            mountedEntries,
            sequence: positionViewCommitSequence,
        });
    });
}

function logPositionViewCommit(entry: PositionViewDebugEntry) {
    if (!IS_DEV) {
        return;
    }

    mountedPositionViews.set(entry.containerId, entry);
    pendingPositionViewCommits.push(entry);
    schedulePositionViewCommitFlush();
}

function logPositionViewUnmount(entry: PositionViewDebugEntry | undefined) {
    if (!IS_DEV || !entry) {
        return;
    }

    mountedPositionViews.delete(entry.containerId);
    console.log("[legend-list][position-view-unmount]", {
        component: entry.component,
        containerId: entry.containerId,
        index: entry.index,
        itemKey: entry.itemKey,
        mountedCount: mountedPositionViews.size,
    });
}

function usePositionViewDebugLogging(entry: PositionViewDebugEntry) {
    const latestEntryRef = React.useRef<PositionViewDebugEntry | undefined>(undefined);
    latestEntryRef.current = entry;

    React.useLayoutEffect(() => {
        logPositionViewCommit(entry);
    }, [entry]);

    React.useLayoutEffect(() => {
        return () => {
            logPositionViewUnmount(latestEntryRef.current);
        };
    }, []);
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const PositionViewState = typedMemo(function PositionViewState({
    id,
    horizontal,
    index,
    itemKey,
    style,
    refView,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    index: number;
    itemKey?: string;
    style: StyleProp<ViewStyle>;
    refView: React.RefObject<View>;
    onLayout: (event: LayoutChangeEvent) => void;
    children: React.ReactNode;
}) {
    const [position = POSITION_OUT_OF_VIEW] = useArr$([`containerPosition${id}`]);
    usePositionViewDebugLogging({
        component: "state",
        containerId: id,
        horizontal,
        index,
        itemKey,
        position,
    });

    return (
        <View
            ref={refView}
            style={[
                style,
                horizontal ? { transform: [{ translateX: position }] } : { transform: [{ translateY: position }] },
            ]}
            {...rest}
        />
    );
});

// The Animated version is better on old arch but worse on new arch.
// And we don't want to use on new arch because it would make position updates
// not synchronous with the rest of the state updates.
const _PositionViewAnimated = typedMemo(function PositionViewAnimated({
    id,
    horizontal,
    index,
    itemKey,
    style,
    refView,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    index: number;
    itemKey?: string;
    style: StyleProp<ViewStyle>;
    refView: React.RefObject<View>;
    onLayout: (event: LayoutChangeEvent) => void;
    children: React.ReactNode;
}) {
    const position$ = useValue$(`containerPosition${id}`, {
        getValue: (v) => v ?? POSITION_OUT_OF_VIEW,
    });
    const [position = POSITION_OUT_OF_VIEW] = useArr$([`containerPosition${id}`]);
    usePositionViewDebugLogging({
        component: "animated",
        containerId: id,
        horizontal,
        index,
        itemKey,
        position,
    });

    let animatedPositionStyle:
        | { transform: Array<{ translateX: Animated.Value }> }
        | { transform: Array<{ translateY: Animated.Value }> }
        | { left: Animated.Value }
        | { top: Animated.Value };

    if (Platform.OS === "ios" || Platform.OS === "android") {
        animatedPositionStyle = horizontal
            ? { transform: [{ translateX: position$ }] }
            : { transform: [{ translateY: position$ }] };
    } else {
        // react-native-macos seems to not work well with transform here
        animatedPositionStyle = horizontal ? { left: position$ } : { top: position$ };
    }

    return <Animated.View ref={refView} style={[style, animatedPositionStyle]} {...rest} />;
});

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const PositionViewSticky = typedMemo(function PositionViewSticky({
    id,
    horizontal,
    itemKey,
    style,
    refView,
    animatedScrollY,
    index,
    stickyHeaderConfig,
    children,
    ...rest
}: {
    id: number;
    horizontal: boolean;
    itemKey?: string;
    style: StyleProp<ViewStyle>;
    refView: React.RefObject<View>;
    animatedScrollY?: Animated.Value;
    onLayout: (event: LayoutChangeEvent) => void;
    index: number;
    stickyHeaderConfig?: StickyHeaderConfig;
    children: React.ReactNode;
}) {
    const [position = POSITION_OUT_OF_VIEW, headerSize = 0, stylePaddingTop = 0] = useArr$([
        `containerPosition${id}`,
        "headerSize",
        "stylePaddingTop",
    ]);
    usePositionViewDebugLogging({
        component: "sticky",
        containerId: id,
        horizontal,
        index,
        itemKey,
        position,
    });

    // Calculate transform based on sticky state
    const transform = React.useMemo(() => {
        if (animatedScrollY) {
            const stickyConfigOffset = stickyHeaderConfig?.offset ?? 0;
            const stickyStart = position + headerSize + stylePaddingTop - stickyConfigOffset;
            const stickyPosition = animatedScrollY.interpolate({
                extrapolateLeft: "clamp",
                extrapolateRight: "extend",
                inputRange: [stickyStart, stickyStart + 5000],
                outputRange: [position, position + 5000],
            });

            return horizontal ? [{ translateX: stickyPosition }] : [{ translateY: stickyPosition }];
        }
    }, [animatedScrollY, headerSize, horizontal, position, stylePaddingTop, stickyHeaderConfig?.offset]);

    const viewStyle = React.useMemo(() => [style, { zIndex: index + 1000 }, { transform }], [style, transform]);

    const renderStickyHeaderBackdrop = React.useMemo(() => {
        if (!stickyHeaderConfig?.backdropComponent) {
            return null;
        }

        return (
            <View
                style={{
                    inset: 0,
                    pointerEvents: "none",
                    position: "absolute",
                }}
            >
                {getComponent(stickyHeaderConfig?.backdropComponent)}
            </View>
        );
    }, [stickyHeaderConfig?.backdropComponent]);

    return (
        <Animated.View ref={refView} style={viewStyle} {...rest}>
            {renderStickyHeaderBackdrop}
            {children}
        </Animated.View>
    );
});

export const PositionView = PositionViewState;
export { PositionViewSticky };
