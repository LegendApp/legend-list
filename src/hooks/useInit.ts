import { useState } from "react";

// A hook that runs a callback only once during the first render.
// It should happen during render, not in useEffect, so that any setState calls during the callback
// will trigger a re-render immediately rather than waiting for a next render.
// See https://react.dev/reference/react/useState#storing-information-from-previous-renders
export function useInit<T>(cb: () => T) {
    // useState with lazy initializer runs only on first render
    useState(() => cb());
}
