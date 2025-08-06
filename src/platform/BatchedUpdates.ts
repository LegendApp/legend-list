// Platform-specific batched updates implementation
let batchedUpdates: (callback: () => void) => void;

try {
    // Try to import react-dom for web
    const { unstable_batchedUpdates } = require("react-dom");
    batchedUpdates = unstable_batchedUpdates;
} catch (e) {
    // Fallback to simple callback execution if react-dom is not available
    batchedUpdates = (callback: () => void) => callback();
}

export { batchedUpdates };