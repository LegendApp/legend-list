import { requireNativeComponent } from "react-native";

import { AutoLayoutViewNativeComponentProps } from "./AutoLayoutViewNativeComponentProps";

const AutoLayoutViewNativeComponent =
  requireNativeComponent<AutoLayoutViewNativeComponentProps>("ALAutoLayoutView");
export default AutoLayoutViewNativeComponent;
