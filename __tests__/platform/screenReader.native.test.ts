import { expect, it, mock, spyOn } from "bun:test";
import "../setup";

it("shares one screen-reader subscription and ignores stale initial queries", async () => {
    let changed: (enabled: boolean) => void = () => {};
    let resolve: (enabled: boolean) => void = () => {};
    const remove = mock(() => {});
    const addEventListener = mock((_name: string, callback: typeof changed) => {
        changed = callback;
        return { remove };
    });
    const { AccessibilityInfo } = await import("react-native");
    spyOn(AccessibilityInfo, "addEventListener").mockImplementation(addEventListener as any);
    spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockImplementation(
        () =>
            new Promise<boolean>((r) => {
                resolve = r;
            }),
    );
    const { subscribeScreenReader, isScreenReaderEnabled } = await import(
        "../../src/platform/screenReader.native?subscription"
    );
    const first = subscribeScreenReader();
    const second = subscribeScreenReader();
    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(isScreenReaderEnabled()).toBe(false);
    changed(true);
    resolve(false);
    await Promise.resolve();
    expect(isScreenReaderEnabled()).toBe(true);
    first();
    expect(remove).not.toHaveBeenCalled();
    second();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(isScreenReaderEnabled()).toBe(false);
    const third = subscribeScreenReader();
    resolve(true);
    await Promise.resolve();
    expect(isScreenReaderEnabled()).toBe(true);
    third();
});
