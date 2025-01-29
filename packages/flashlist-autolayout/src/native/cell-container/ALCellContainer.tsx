import React from "react";
import { View, ViewProps } from "react-native";

export interface ALCellContainerProps extends ViewProps {
  index: number;
}

const ALCellContainer = React.forwardRef(
  (props: ALCellContainerProps, ref: any) => {
    return <View ref={ref} {...props} />;
  }
);
ALCellContainer.displayName = "ALCellContainer";
export default ALCellContainer;
