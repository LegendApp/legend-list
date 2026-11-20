import { expect, it } from "bun:test";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dir, "../..");
const config = ts.readConfigFile(resolve(root, "tsconfig.src.json"), ts.sys.readFile);
const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;

for (const [name, entry] of [
    ["source", "src/integrations/animated"],
    ...(process.env.TEST_BUILT_TYPES ? [["built", "dist/animated"]] : []),
]) {
    it(`types AnimatedLegendList with LegendList's props and animated values (${name})`, () => {
        const file = resolve(root, "__tests__/integrations/animated-consumer.tsx");
        const source = `
import * as React from "react";
import { Animated, Text } from "react-native";
import { AnimatedLegendList } from "../../${entry}";
import type { LegendListRef } from "../../src/react-native";

type Item = { id: string; title: string };
const data: Item[] = [{ id: "1", title: "One" }];
const scrollY = new Animated.Value(0);
const ref = React.createRef<LegendListRef>();
const textRef = React.createRef<Text>();

const ok = (
    <AnimatedLegendList
        ref={ref}
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Text>{item.title}</Text>}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        style={{ opacity: scrollY }}
    />
);

// @ts-expect-error unknown props are rejected
const unknownProp = <AnimatedLegendList data={data} renderItem={() => null} notAProp />;

const unknownField = (
    <AnimatedLegendList
        data={data}
        // @ts-expect-error item is inferred from data
        renderItem={({ item }) => <Text>{item.nope}</Text>}
    />
);

// @ts-expect-error the ref is a LegendListRef
const wrongRef = <AnimatedLegendList ref={textRef} data={data} renderItem={() => null} />;
`;
        const host = ts.createCompilerHost(options);
        const getSourceFile = host.getSourceFile.bind(host);
        host.getSourceFile = (path, languageVersion, ...rest) =>
            path === file
                ? ts.createSourceFile(path, source, languageVersion)
                : getSourceFile(path, languageVersion, ...rest);
        const program = ts.createProgram([file], { ...options, incremental: false, noEmit: true }, host);
        const diagnostics = program.getSemanticDiagnostics(program.getSourceFile(file));
        expect(diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))).toEqual(
            [],
        );
    });
}
