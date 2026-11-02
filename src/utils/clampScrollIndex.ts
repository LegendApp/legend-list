export function clampScrollIndex(index: number, dataLength: number) {
    if (dataLength <= 0) {
        return -1;
    }

    if (index >= dataLength) {
        return dataLength - 1;
    }

    if (index < 0) {
        return 0;
    }

    return index;
}
