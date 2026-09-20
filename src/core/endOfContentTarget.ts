import type { InternalState } from "@/types.internal";

/*
 * Two kinds of scroll targets exist, and only one of them accounts for the
 * space after the last row (end padding + footer):
 *
 * - Item-aligned targets (scrollToIndex and initialScrollIndex objects with an
 *   explicit viewOffset or without bottom alignment) align the row itself.
 *   calculateOffsetWithOffsetPosition never adds trailing space for them.
 * - End-of-content targets (scrollToEnd, initialScrollAtEnd, and the automatic
 *   bottom alignment of a numeric initialScrollIndex on the last row) align the
 *   end of the content. Bottom-aligned initialScrollIndex objects targeting the
 *   last row also count the footer when viewOffset is omitted. These targets
 *   carry the trailing space in viewOffset, computed here.
 */
export function getEndAlignedViewOffset(stylePaddingEnd: number, footerSize = 0) {
    return -stylePaddingEnd - footerSize;
}

export function isEndOfContentTarget(target: InternalState["initialScroll"], dataLength: number) {
    return (
        !!target &&
        dataLength > 0 &&
        target.viewPosition === 1 &&
        !!target.preserveForBottomPadding &&
        target.index !== undefined &&
        target.index >= dataLength - 1
    );
}
