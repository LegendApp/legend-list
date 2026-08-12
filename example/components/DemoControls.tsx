import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function DemoButton({ label, onPress }: { label: string; onPress: () => void }) {
    return (
        <Pressable accessibilityRole="button" onPress={onPress} style={styles.button}>
            <Text style={styles.buttonText}>{label}</Text>
        </Pressable>
    );
}

export function DemoControlRow({ children }: { children: ReactNode }) {
    return <View style={styles.row}>{children}</View>;
}

export function DemoHint({ children }: { children: ReactNode }) {
    return <Text style={styles.hint}>{children}</Text>;
}

export function DemoModeSwitch<Mode extends string>({
    modes,
    onSelect,
    selected,
}: {
    modes: ReadonlyArray<{ label: string; value: Mode }>;
    onSelect: (mode: Mode) => void;
    selected: Mode;
}) {
    return (
        <View accessibilityRole="tablist" style={styles.modeSwitch}>
            {modes.map((mode) => {
                const isSelected = mode.value === selected;
                return (
                    <Pressable
                        accessibilityRole="tab"
                        accessibilityState={{ selected: isSelected }}
                        key={mode.value}
                        onPress={() => onSelect(mode.value)}
                        style={[styles.mode, isSelected && styles.modeSelected]}
                    >
                        <Text style={[styles.modeText, isSelected && styles.modeTextSelected]}>{mode.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    button: {
        backgroundColor: "#FFFFFF",
        borderColor: "#CBD5E1",
        borderRadius: 8,
        borderWidth: 1,
        flexGrow: 1,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    buttonText: {
        color: "#1E293B",
        fontSize: 12,
        fontWeight: "700",
        textAlign: "center",
    },
    hint: {
        color: "#475569",
        fontSize: 13,
        lineHeight: 18,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    mode: {
        alignItems: "center",
        borderRadius: 7,
        flex: 1,
        paddingHorizontal: 8,
        paddingVertical: 7,
    },
    modeSelected: {
        backgroundColor: "#0F172A",
    },
    modeSwitch: {
        backgroundColor: "#E2E8F0",
        borderRadius: 9,
        flexDirection: "row",
        margin: 10,
        padding: 2,
    },
    modeText: {
        color: "#475569",
        fontSize: 12,
        fontWeight: "700",
    },
    modeTextSelected: {
        color: "#FFFFFF",
    },
    row: {
        flexDirection: "row",
        gap: 8,
        paddingBottom: 10,
        paddingHorizontal: 10,
    },
});
