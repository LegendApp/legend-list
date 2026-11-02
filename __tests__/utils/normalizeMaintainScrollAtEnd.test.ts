import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";
import ts from "typescript";
import "../setup";

import { normalizeMaintainScrollAtEnd } from "../../src/utils/normalizeMaintainScrollAtEnd";

describe("normalizeMaintainScrollAtEnd", () => {
    it("returns undefined for falsey values", () => {
        expect(normalizeMaintainScrollAtEnd(false)).toBeUndefined();
        expect(normalizeMaintainScrollAtEnd(undefined)).toBeUndefined();
    });

    it("enables all triggers for boolean true", () => {
        expect(normalizeMaintainScrollAtEnd(true)).toEqual({
            animated: false,
            onDataChange: true,
            onFooterLayout: true,
            onItemLayout: true,
            onLayout: true,
        });
    });

    it("treats modifier-only object values as shorthand for all triggers", () => {
        expect(normalizeMaintainScrollAtEnd({ animated: true })).toEqual({
            animated: true,
            onDataChange: true,
            onFooterLayout: true,
            onItemLayout: true,
            onLayout: true,
        });
    });

    it("supports explicit on configs", () => {
        expect(normalizeMaintainScrollAtEnd({ animated: true, on: { layout: true } })).toEqual({
            animated: true,
            onDataChange: false,
            onFooterLayout: false,
            onItemLayout: false,
            onLayout: true,
        });
        expect(normalizeMaintainScrollAtEnd({ on: { layout: true } })).toEqual({
            animated: false,
            onDataChange: false,
            onFooterLayout: false,
            onItemLayout: false,
            onLayout: true,
        });
        expect(
            normalizeMaintainScrollAtEnd({ on: { dataChange: true, footerLayout: true, itemLayout: true } }),
        ).toEqual({
            animated: false,
            onDataChange: true,
            onFooterLayout: true,
            onItemLayout: true,
            onLayout: false,
        });
        expect(normalizeMaintainScrollAtEnd({ on: { dataChange: true, itemLayout: true } })).toEqual({
            animated: false,
            onDataChange: true,
            onFooterLayout: false,
            onItemLayout: true,
            onLayout: false,
        });
    });

    it("enables append-only following without overriding all-data following", () => {
        expect(normalizeMaintainScrollAtEnd({ on: { dataAppend: true } })?.onDataChange).toBe("append");
        expect(normalizeMaintainScrollAtEnd({ on: { dataAppend: true, dataChange: true } })?.onDataChange).toBe(true);
        expect(normalizeMaintainScrollAtEnd({ on: { dataAppend: true, dataChange: false } })?.onDataChange).toBe(
            "append",
        );
        expect(normalizeMaintainScrollAtEnd({ on: { dataAppend: false } })?.onDataChange).toBe(false);
    });

    it("defaults object values without on to all triggers", () => {
        expect(normalizeMaintainScrollAtEnd({})).toEqual({
            animated: false,
            onDataChange: true,
            onFooterLayout: true,
            onItemLayout: true,
            onLayout: true,
        });
    });
});

it("keeps dataChange readable as a boolean in public options", () => {
    const root = resolve(import.meta.dir, "../..");
    const config = ts.readConfigFile(resolve(root, "tsconfig.src.json"), ts.sys.readFile);
    const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
    const file = resolve(root, "__tests__/utils/maintain-scroll-at-end-consumer.ts");
    const source = `
import type { MaintainScrollAtEndOnOptions as WebOptions } from "../../src/types.web";
import type { MaintainScrollAtEndOnOptions as NativeOptions } from "../../src/types.react-native";
declare const webOptions: WebOptions;
declare const nativeOptions: NativeOptions;
const webDataChange: boolean = webOptions.dataChange ?? false;
const nativeDataChange: boolean = nativeOptions.dataChange ?? false;
const webAppend: WebOptions = { dataAppend: true };
const nativeAppend: NativeOptions = { dataAppend: true };
`;
    const host = ts.createCompilerHost(options);
    const getSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (path, languageVersion, ...rest) =>
        path === file
            ? ts.createSourceFile(path, source, languageVersion)
            : getSourceFile(path, languageVersion, ...rest);
    const program = ts.createProgram([file], { ...options, incremental: false, noEmit: true }, host);
    const diagnostics = ts.getPreEmitDiagnostics(program).filter((diagnostic) => diagnostic.file?.fileName === file);
    expect(diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))).toEqual([]);
});
