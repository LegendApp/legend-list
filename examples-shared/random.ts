export function createSeededRandom(seed: number) {
    let current = seed >>> 0;

    return () => {
        current = (current * 1664525 + 1013904223) >>> 0;
        return current / 0x100000000;
    };
}

export function pickOne<T>(values: readonly T[], random: () => number) {
    return values[Math.floor(random() * values.length)]!;
}
