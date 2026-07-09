export const flushSync = (fn: () => void): void => {
    fn();
};
