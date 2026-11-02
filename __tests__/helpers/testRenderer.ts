export * from "react-test-renderer";

import * as ReactTestRenderer from "react-test-renderer";

import { withLayoutInvariants } from "./layoutInvariantHarness";

export const act = withLayoutInvariants(ReactTestRenderer.act);

export default (ReactTestRenderer as unknown as { default?: any }).default ?? ReactTestRenderer;
