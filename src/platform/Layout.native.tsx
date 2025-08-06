import { 
    Dimensions as RNDimensions, 
    StyleSheet as RNStyleSheet,
    type LayoutChangeEvent as RNLayoutChangeEvent,
    type LayoutRectangle as RNLayoutRectangle 
} from "react-native";

export type LayoutRectangle = RNLayoutRectangle;
export type LayoutChangeEvent = RNLayoutChangeEvent;
export const Dimensions = RNDimensions;
export const StyleSheet = RNStyleSheet;