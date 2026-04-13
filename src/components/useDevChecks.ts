import { type ReactElement, useEffect } from "react";

import { Platform } from "@/platform/Platform";
import type { LooseScrollViewProps } from "@/platform/scrollview-types";
import { listen$, peek$, useStateContext } from "@/state/state";
import type { LegendListPropsBase } from "@/types.internal";
import { IS_DEV } from "@/utils/devEnvironment";
import { warnDevOnce } from "@/utils/helpers";

const WEB_UNBOUNDED_HEIGHT_MIN_DATA_LENGTH = 100;
const WEB_UNBOUNDED_HEIGHT_CONTAINER_RATIO = 0.9;
const WEB_UNBOUNDED_HEIGHT_VIEWPORT_RATIO = 0.9;

type LegendListDevProps<T> = LegendListPropsBase<T, LooseScrollViewProps> & {
    childrenMode?: boolean;
    renderScrollComponent?: ((props: LooseScrollViewProps) => ReactElement | null) | undefined;
    stickyHeaderIndices?: number[] | undefined;
    stickyIndices?: number[] | undefined;
    useWindowScroll?: boolean | undefined;
};

function useDevChecksImpl(props: LegendListDevProps<any>) {
    const ctx = useStateContext();
    const { childrenMode, keyExtractor, renderScrollComponent, stickyHeaderIndices, stickyIndices, useWindowScroll } =
        props;

    useEffect(() => {
        if (stickyIndices && !stickyHeaderIndices) {
            warnDevOnce(
                "stickyIndices",
                "stickyIndices has been renamed to stickyHeaderIndices. Please update your props to use stickyHeaderIndices.",
            );
        }
    }, [stickyHeaderIndices, stickyIndices]);

    useEffect(() => {
        if (useWindowScroll && renderScrollComponent) {
            warnDevOnce(
                "useWindowScrollRenderScrollComponent",
                "useWindowScroll is not supported when renderScrollComponent is provided.",
            );
        }
    }, [renderScrollComponent, useWindowScroll]);

    useEffect(() => {
        if (!keyExtractor && !ctx.state.isFirst && ctx.state.didDataChange && !childrenMode) {
            warnDevOnce(
                "keyExtractor",
                "Changing data without a keyExtractor can cause slow performance and resetting scroll. If your list data can change you should use a keyExtractor with a unique id for best performance and behavior.",
            );
        }
    }, [childrenMode, ctx, keyExtractor]);

    useEffect(() => {
        const state = ctx.state;
        const dataLength = state.props.data.length;
        const useWindowScrollResolved = state.props.useWindowScroll;

        if (Platform.OS !== "web" || useWindowScrollResolved || dataLength < WEB_UNBOUNDED_HEIGHT_MIN_DATA_LENGTH) {
            return;
        }

        const warnIfUnboundedOuterSize = () => {
            const readyToRender = peek$(ctx, "readyToRender");
            const numContainers = peek$(ctx, "numContainers") || 0;
            const totalSize = peek$(ctx, "totalSize") || 0;
            const scrollLength = ctx.state.scrollLength || 0;

            if (!readyToRender || totalSize <= 0 || scrollLength <= 0) {
                return;
            }

            const rendersAlmostEverything =
                numContainers >= Math.ceil(dataLength * WEB_UNBOUNDED_HEIGHT_CONTAINER_RATIO);
            const viewportMatchesContent = scrollLength >= totalSize * WEB_UNBOUNDED_HEIGHT_VIEWPORT_RATIO;

            if (rendersAlmostEverything && viewportMatchesContent) {
                warnDevOnce(
                    "webUnboundedOuterSize",
                    "LegendList appears to have an unbounded outer height on web, so virtualization is effectively disabled. Set a bounded height or flex: 1 on the list container, or use useWindowScroll.",
                );
            }
        };

        warnIfUnboundedOuterSize();

        const unsubscribe = [
            listen$(ctx, "numContainers", warnIfUnboundedOuterSize),
            listen$(ctx, "readyToRender", warnIfUnboundedOuterSize),
            listen$(ctx, "totalSize", warnIfUnboundedOuterSize),
        ];

        return () => {
            for (const unsub of unsubscribe) {
                unsub();
            }
        };
    }, [ctx]);
}

function useDevChecksNoop(_props: LegendListDevProps<any>) {}

export const useDevChecks = IS_DEV ? useDevChecksImpl : useDevChecksNoop;
