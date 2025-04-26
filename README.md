# Legend List

**Legend List** is a high-performance list component for **React Native**, written purely in Typescript with no native dependencies. It is a drop-in replacement for `FlatList` and `FlashList` with better performance, especially when handling dynamically sized items.

<video src="https://github.com/user-attachments/assets/8641e305-ab06-4fb3-a96a-fd220df84985"></video>

---

## 🤔 Why Legend List?

*   **Performance:** Designed from the ground up and heavily optimized for performance, it is faster than FlatList and other list libraries in most scenarios.
*   **Dynamic Item Sizes:** Natively supports items with varying heights without performance hits.
*   **Drop-in Replacement:** API compatibility with `FlatList` and `FlashList` for easier migration.
*   **100% JS:** No native module linking required, ensuring easy integration and compatibility across platforms.
*   **Lightweight:** Our goal is to keep LegendList as small of a dependency as possible. For more advanced use cases, we plan on supporting optional plugins. This ensures that we keep the package size as small as possible.
*   **Bidirectional infinite lists:** Supports infinite scrolling in both directions with no flashes or scroll jumping
*   **Chat UIs without inverted:** Chat UIs can align their content to the bottom and maintain scroll at end, so that the list doesn't need to be inverted, which causes weird behavior (in animations, etc...)

For more information, listen to the Legend List episode of the [React Native Radio Podcast](https://infinite.red/react-native-radio/rnr-325-legend-list-with-jay-meistrich) and the [livestream with Expo](https://www.youtube.com/watch?v=XpZMveUCke8).

---
## ✨ Additional Features

Beyond standard `FlatList` capabilities:

*   `recycleItems`: (boolean) Toggles item component recycling.
    *   `true`: Reuses item components for optimal performance. Be cautious if your item components contain local state, as it might be reused unexpectedly.
    *   `false` (default): Creates new item components every time. Less performant but safer if items have complex internal state.
*   `maintainScrollAtEnd`: (boolean) If `true` and the user is scrolled near the bottom (within `maintainScrollAtEndThreshold * screen height`), the list automatically scrolls to the end when items are added or heights change. Useful for chat interfaces.
*   `alignItemsAtEnd`: (boolean) Useful for chat UIs, content smaller than the View will be aligned to the bottom of the list.

---

## 📚 Documentation

For comprehensive documentation, guides, and the full API reference, please visit:

➡️ **[Legend List Documentation Site](https://www.legendapp.com/open-source/list)**

---

## 💻 Usage

### Installation

```bash
# Using Bun
bun add @legendapp/list

# Using npm
npm install @legendapp/list

# Using Yarn
yarn add @legendapp/list
```

### Example
```tsx
import React, { useRef } from "react"
import { View, Image, Text, StyleSheet } from "react-native"
import { LegendList, LegendListRef, LegendListRenderItemProps } from "@legendapp/list"

// Define the type for your data items
interface UserData {
    id: string;
    name: string;
    photoUri: string;
}

const LegendListExample = () => {
    // Optional: Ref for accessing list methods (e.g., scrollTo)
    const listRef = useRef<LegendListRef | null>(null)

    const data = []

    const renderItem = ({ item }: LegendListRenderItemProps<UserData>) => {
        return (
            <View>
                <Image source={{ uri: item.photoUri }} />
                <Text>{item.name}</Text>
            </View>
        )
    }

    return (
        <LegendList
            // Required Props
            data={data}
            renderItem={renderItem}

            // Recommended props (Improves performance)
            keyExtractor={(item) => item.id}
            recycleItems={true}

            // Recommended if data can change
            maintainVisibleContentPosition

            ref={listRef}
        />
    )
}

export default LegendListExample

```

---

## How to Build

1. `bun i`
2. `bun run build` will build the package to the `dist` folder.

## Running the Example

1. `cd example`
2. `bun i`
3. `bun run ios`

## PRs gladly accepted!

There's not a ton of code so hopefully it's easy to contribute. If you want to add a missing feature or fix a bug please post an issue to see if development is already in progress so we can make sure to not duplicate work 😀.

## Upcoming Roadmap

- [] Column spans
- [] overrideItemLayout
- [] Sticky headers
- [] Masonry layout
- [] getItemType
- [] React DOM implementation

## Community

Join us on [Discord](https://discord.gg/tuW2pAffjA) to get involved with the Legend community.

## 👩‍⚖️ License

[MIT](LICENSE)
