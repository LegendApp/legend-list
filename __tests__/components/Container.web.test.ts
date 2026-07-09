import { describe, expect, it } from "bun:test";
import { getContainerPositionStyle } from "../../src/components/Container?web-style";

describe("Container (web)", () => {
    it("uses CSS padding and border-box sizing for vertical multi-column gaps", () => {
        expect(
            getContainerPositionStyle({
                columnWrapperStyle: { columnGap: 12, rowGap: 8 },
                contentContainerAlignItems: undefined,
                hasItemSeparator: false,
                horizontal: false,
                numColumns: 2,
                otherAxisPos: 0,
                otherAxisSize: "50%",
            }),
        ).toMatchObject({
            boxSizing: "border-box",
            paddingBottom: 8,
            paddingLeft: 6,
            paddingRight: 6,
            right: null,
            width: "50%",
        });
    });

    it("uses CSS padding and border-box sizing for horizontal multi-column gaps", () => {
        expect(
            getContainerPositionStyle({
                columnWrapperStyle: { columnGap: 12, rowGap: 8 },
                contentContainerAlignItems: undefined,
                hasItemSeparator: true,
                horizontal: true,
                numColumns: 2,
                otherAxisPos: 0,
                otherAxisSize: "50%",
            }),
        ).toMatchObject({
            boxSizing: "border-box",
            flexDirection: "row",
            height: "50%",
            paddingBottom: 4,
            paddingRight: 12,
            paddingTop: 4,
        });
    });

    it("bottom-aligns horizontal single-column containers for flex-end content alignment", () => {
        expect(
            getContainerPositionStyle({
                columnWrapperStyle: undefined,
                contentContainerAlignItems: "flex-end",
                hasItemSeparator: false,
                horizontal: true,
                numColumns: 1,
                otherAxisPos: 0,
                otherAxisSize: undefined,
            }),
        ).toMatchObject({
            bottom: 0,
            left: 0,
            position: "absolute",
            top: undefined,
        });
    });
});
