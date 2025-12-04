import React from "react";

const internals = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED ?? {};

if (!internals.S) {
    internals.S = React.startTransition ? (callback: () => void) => React.startTransition(callback) : undefined;
}

export * from "react-test-renderer";

import * as ReactTestRenderer from "react-test-renderer";

export default (ReactTestRenderer as unknown as { default?: any }).default ?? ReactTestRenderer;
