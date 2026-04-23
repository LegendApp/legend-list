import "../setup";

import { describe, expect, it, mock } from "bun:test";
import { PositionViewSticky } from "../../src/components/PositionView.native";
import { StateProvider, useStateContext } from "../../src/state/state";
import { createMockState } from "../__mocks__/createMockState";
import { render } from "../helpers/testingLibrary";

function StickyHarness({
    animatedScrollY,
    currentSize,
    index,
    itemKey,
    nextStickyPosition,
    position,
    stickyIndices,
}: {
    animatedScrollY: { interpolate: (config: any) => any };
    currentSize: number;
    index: number;
    itemKey: string;
    nextStickyPosition: number;
    position: number;
    stickyIndices: number[];
}) {
    const ctx = useStateContext();

    if (!ctx.state) {
        ctx.state = createMockState({
            positions: [],
            props: {
                stickyIndicesArr: stickyIndices,
            },
        }) as any;
    }

    ctx.state.positions[index] = position;
    ctx.state.positions[stickyIndices[stickyIndices.indexOf(index) + 1]] = nextStickyPosition;
    ctx.state.props.stickyIndicesArr = stickyIndices;
    ctx.state.sizes.set(itemKey, currentSize);

    ctx.values.set(`containerPosition7`, position);
    ctx.values.set(`containerItemKey7`, itemKey);
    ctx.values.set("headerSize", 0);
    ctx.values.set("stylePaddingTop", 0);
    ctx.values.set("totalSize", nextStickyPosition + currentSize);

    return (
        <PositionViewSticky
            animatedScrollY={animatedScrollY as any}
            horizontal={false}
            id={7}
            index={index}
            onLayout={() => {}}
            refView={{ current: null }}
            style={{}}
        >
            {null}
        </PositionViewSticky>
    );
}

describe("PositionViewSticky.native", () => {
    it("pushes a tall sticky header out when the next sticky header arrives", () => {
        const interpolate = mock((config: any) => config);
        const animatedScrollY = { interpolate };
        const { toJSON, unmount } = render(
            <StateProvider>
                <StickyHarness
                    animatedScrollY={animatedScrollY}
                    currentSize={120}
                    index={1}
                    itemKey="header-1"
                    nextStickyPosition={300}
                    position={100}
                    stickyIndices={[1, 5]}
                />
            </StateProvider>,
        );

        const expectedInterpolation = {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            inputRange: [100, 180],
            outputRange: [100, 180],
        };

        expect(interpolate).toHaveBeenCalledTimes(1);
        expect(interpolate).toHaveBeenCalledWith(expectedInterpolation);

        const style = (toJSON() as any)?.props?.style;
        const flattenedStyle = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
        expect(flattenedStyle?.top).toEqual(expectedInterpolation);
        expect(flattenedStyle?.transform).toBeUndefined();

        unmount();
    });
});
