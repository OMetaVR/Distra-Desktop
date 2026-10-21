/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Fork-only (see FORK.md): shows this fork as Distra without editing upstream source.
// Only the text inside string literals, template literals and JSX text is rewritten, so identifiers, imports,
// storage keys like "EquicordChangelog_History" and URLs like github.com/Equicord/... are never touched.

import { readFile } from "fs/promises";
import ts from "typescript";

export const CLIENT_NAME = "Distra";
export const INSTALLER_NAME = "Distra Installer";

// Text that refers to Equicord itself rather than this client stays as is: credits, Equicord's donor, contributor and
// translator programs, its team, support server and cloud service, and values other services expect.
const KEEP = [
    /Equicord (?:donors?|contributors?|translators?|team|staff|support|server)\b/gi,
    /(?:based on|fork of|thanks to|credit to|made by) Equicord/gi,
    /Equicord \(Not Vencord\)/g,
    /(?:development of|contributed to|contributing to|supporting) Equicord/gi,
    /Equicord(?:’|')s (?:language support|server|and Vencord(?:’|')s cloud)/g,
    /Equicord users can see/g,
    /Equicord (?:and|&) Vencord (?:plugin )?developers/g,
    /Equicord is Open Source Software/g,
    /Equicord \(https:\/\/github\.com\/Equicord/g,
    /client=Equicord/g
];

// Whole files about Equicord's own support server.
const SKIP = [/src[\\/]plugins[\\/]_core[\\/]supportHelper\.tsx$/, /src[\\/]equicordplugins[\\/]equicordHelper[\\/]/];

// Exact strings to keep in specific files, where the same words elsewhere mean this client.
const KEEP_IN_FILE = [
    // Equicord's cloud backend and its icon.
    [/settings[\\/]tabs[\\/]sync[\\/]CloudTab\.tsx$/, ["Equicord Cloud", "Equicord"]],
    // Marks plugins written by Equicord's developers.
    [/settings[\\/]tabs[\\/]plugins[\\/]PluginCard\.tsx$/, ["Equicord", "Equicord Plugin"]],
    [/settings[\\/]tabs[\\/]plugins[\\/]index\.tsx$/, ["Show Equicord"]],
    // Badges from other people's Equicord, and the Equicord console icon.
    [/globalBadges[\\/]utils\.ts$/, ["Equicord"]],
    [/platformIndicators[\\/]index\.tsx$/, ["Equicord"]]
];

const DATA_FOLDER_CALL = /\b(?:join|resolve)\s*\(/;

const NAME = /(?<![\w$/.@#-])(Equicord|Equilotl)(?![\w$/-]|\.[A-Za-z])/g;

function rebrand(text) {
    const kept = [];
    const masked = KEEP.reduce((s, re) => s.replace(re, m => `\u0000${kept.push(m) - 1}\u0000`), text);
    return masked
        .replace(NAME, name => name === "Equilotl" ? INSTALLER_NAME : CLIENT_NAME)
        .replace(/\u0000(\d+)\u0000/g, (_, i) => kept[i]);
}

const TEXT_KINDS = new Set([
    ts.SyntaxKind.StringLiteral,
    ts.SyntaxKind.NoSubstitutionTemplateLiteral,
    ts.SyntaxKind.TemplateHead,
    ts.SyntaxKind.TemplateMiddle,
    ts.SyntaxKind.TemplateTail,
    ts.SyntaxKind.JsxText
]);

/** Returns the rebranded source and a list of changes, or null when nothing changed. */
export function rebrandSource(path, source) {
    if (!/Equicord|Equilotl/.test(source) || SKIP.some(re => re.test(path))) return null;
    const keepExact = KEEP_IN_FILE.filter(([re]) => re.test(path)).flatMap(([, strings]) => strings);

    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const edits = [];

    (function visit(node) {
        if (TEXT_KINDS.has(node.kind)) {
            const start = node.getStart(file), end = node.getEnd();
            const text = source.slice(start, end);
            // A string that is exactly the name, passed to path.join/resolve, is a data folder name.
            const isDataFolder = node.kind === ts.SyntaxKind.StringLiteral && node.text === "Equicord"
                && ts.isCallExpression(node.parent) && DATA_FOLDER_CALL.test(node.parent.expression.getText(file) + "(");
            const keep = isDataFolder || (node.kind !== ts.SyntaxKind.JsxText && keepExact.includes(node.text));
            const next = keep ? text : rebrand(text);
            if (next !== text) edits.push({ start, end, text: next, line: file.getLineAndCharacterOfPosition(start).line + 1, from: text });
        }
        ts.forEachChild(node, visit);
    })(file);

    if (!edits.length) return null;

    let out = source;
    for (const { start, end, text } of edits.toSorted((a, b) => b.start - a.start))
        out = out.slice(0, start) + text + out.slice(end);
    return { code: out, edits };
}

/** @type {import("esbuild").Plugin} */
export const brandingPlugin = {
    name: "distra-branding",
    setup(build) {
        build.onLoad({ filter: /[\\/]src[\\/].*\.tsx?$/ }, async ({ path }) => {
            const result = rebrandSource(path, await readFile(path, "utf-8"));
            if (!result) return undefined;
            return { contents: result.code, loader: path.endsWith("x") ? "tsx" : "ts" };
        });
    }
};
