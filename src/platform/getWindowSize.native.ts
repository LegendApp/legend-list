import { Dimensions } from "react-native";

export function getWindowSize() {
    const screenSize = Dimensions.get("window");

    return {
        height: screenSize.height,
        width: screenSize.width,
    };
}
