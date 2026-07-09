import { Platform as RNPlatform } from "react-native";

export const Platform = RNPlatform;

export const PlatformAdjustBreaksScroll = Platform.OS === "android";
