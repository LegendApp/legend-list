import React from "react";

export * from "react-test-renderer";

import * as ReactTestRenderer from "react-test-renderer";

export default (ReactTestRenderer as unknown as { default?: any }).default ?? ReactTestRenderer;
