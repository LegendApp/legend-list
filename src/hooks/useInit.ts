import { useRef } from "react";

const symbolFirst = Symbol();
// A hook that runs a callback only once during the first render.
// It should happen during render, not in useEffect, so that any setState calls during the callback
// will trigger a re-render immediately rather than waiting for a next render.
// See https://react.dev/reference/react/useState#storing-information-from-previous-renders
export function useInit<T>(cb: () => T) {
    const refValue = useRef<T | typeof symbolFirst>(symbolFirst);

    // Run inline during first render only
    if (refValue.current === symbolFirst) {
        refValue.current = cb();
    }

    return refValue.current;
}
