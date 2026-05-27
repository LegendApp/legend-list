import {
    KeyboardAwareLegendList,
    useKeyboardChatComposerInset as useKeyboardChatComposerInsetFromKeyboard,
    useKeyboardScrollToEnd as useKeyboardScrollToEndFromKeyboard,
} from "./keyboard";

/**
 * @deprecated Import KeyboardAwareLegendList from @legendapp/list/keyboard instead.
 */
export const KeyboardChatLegendList = KeyboardAwareLegendList;

/**
 * @deprecated Import useKeyboardChatComposerInset from @legendapp/list/keyboard instead.
 */
export const useKeyboardChatComposerInset = useKeyboardChatComposerInsetFromKeyboard;

/**
 * @deprecated Import useKeyboardScrollToEnd from @legendapp/list/keyboard instead.
 */
export const useKeyboardScrollToEnd = useKeyboardScrollToEndFromKeyboard;
