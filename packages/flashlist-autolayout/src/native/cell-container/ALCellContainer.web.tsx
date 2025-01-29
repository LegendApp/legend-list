import React from "react";
/**
 * On web we use a view instead of cell container till we build native web implementations
 */
const ALCellContainer = React.forwardRef((props: any, ref) => {
  return <div ref={ref} {...props} />;
});
ALCellContainer.displayName = "ALCellContainer";
export default ALCellContainer;
