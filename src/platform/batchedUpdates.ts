import { unstable_batchedUpdates } from "react-native";

const batchedUpdates = unstable_batchedUpdates || ((callback: () => void) => callback());

export { batchedUpdates };
