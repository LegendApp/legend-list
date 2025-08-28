import { unstable_batchedUpdates } from "react-dom";

const batchedUpdates = unstable_batchedUpdates || ((callback: () => void) => callback());

export { batchedUpdates };
