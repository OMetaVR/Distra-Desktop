/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { createAndAppendStyle } from "@utils/css";
import { PluginNative } from "@utils/types";

// Settings use the same shape as Distra for iOS's Font Loader so they can sync between the two.

export interface FontFile {
    weight: number;
    italic: boolean;
}

export interface InstalledFont {
    id: string;
    name: string;
    source: "google" | "url";
    url?: string;
    faces: FontFile[];
    monospace: boolean;
    installedAt: number;
}

export interface FontAdjust {
    size: number;
    match: boolean;
    weight: number;
    spacing: number;
}

export type FontGroup = "text" | "code";

export interface FontSettings {
    fonts: Record<string, InstalledFont>;
    text: string;
    code: string;
    headings: boolean;
    scope?: "app" | "messages";
    adjust: Record<FontGroup, FontAdjust>;
}

export const defaultAdjust: FontAdjust = { size: 100, match: false, weight: 0, spacing: 100 };

export const SUGGESTED = [
    "Inter", "Roboto", "Open Sans", "Lato", "Nunito", "Poppins", "Montserrat", "Rubik", "Quicksand",
    "Comfortaa", "Lexend", "Atkinson Hyperlegible", "Noto Serif", "Merriweather", "Comic Neue",
    "JetBrains Mono", "Fira Code", "Source Code Pro", "IBM Plex Mono", "Roboto Mono"
];

const Native = VencordNative.pluginHelpers.CustomFonts as PluginNative<typeof import("./native")>;

const DISCORD_FAMILIES: Record<FontGroup, string[]> = { text: ["gg sans"], code: ["gg mono", "Source Code Pro"] };
const HEADING_FAMILIES = ["ABC Ginto Nord", "ABC Ginto Normal"];
const PREVIEW_FAMILY: Record<FontGroup, string> = { text: "Distra Text", code: "Distra Code" };
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const SAMPLE = "The quick brown fox jumps over the lazy dog.";

const filesKey = (id: string) => `CustomFonts_${id}`;

async function unwrap<T>(result: Promise<{ success: true; data: T; } | { success: false; error: string; }>) {
    const res = await result;
    if (!res.success) throw new Error(res.error);
    return res.data;
}

function readFontInfo(buffer: ArrayBuffer) {
    const view = new DataView(buffer);
    const tag = (offset: number) => String.fromCharCode(...new Uint8Array(buffer, offset, 4));
    if (!["\0\x01\0\0", "OTTO", "true"].includes(tag(0))) throw new Error("That isn't a .ttf or .otf font");

    const tables = new Map<string, number>();
    for (let i = 0; i < view.getUint16(4); i++) tables.set(tag(12 + i * 16), view.getUint32(12 + i * 16 + 8));

    const os2 = tables.get("OS/2");
    const post = tables.get("post");
    const info = {
        name: "",
        weight: os2 ? view.getUint16(os2 + 4) : 400,
        italic: os2 ? (view.getUint16(os2 + 62) & 1) === 1 : false,
        monospace: post ? view.getUint32(post + 12) !== 0 : false
    };

    const names = tables.get("name");
    if (names) {
        const strings = names + view.getUint16(names + 4);
        const found: Record<number, string> = {};
        for (let i = 0; i < view.getUint16(names + 2); i++) {
            const record = names + 6 + i * 12;
            const [platform, nameId, length, offset] = [view.getUint16(record), view.getUint16(record + 6), view.getUint16(record + 8), view.getUint16(record + 10)];
            if ((nameId !== 1 && nameId !== 16) || found[nameId]) continue;
            const bytes = new Uint8Array(buffer, strings + offset, length);
            found[nameId] = platform === 3 || platform === 0 ? new TextDecoder("utf-16be").decode(bytes) : String.fromCharCode(...bytes);
        }
        info.name = found[16] || found[1] || "";
    }
    return info;
}

export const googleFontId = (family: string) => `google-${family.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

export async function searchGoogleFonts(query: string): Promise<string[]> {
    const data: unknown = await unwrap(Native.searchGoogleFonts(query));
    if (!Array.isArray(data) || !Array.isArray(data[1])) return [];
    return data[1].map(entry => entry?.[1]?.[0]).filter((family): family is string => typeof family === "string");
}

export async function installGoogleFont(family: string): Promise<InstalledFont> {
    const css = await unwrap(Native.googleFontCss(family)).catch(() => {
        throw new Error(`Google Fonts has no font called ${family}`);
    });

    const faces: FontFile[] = [];
    const files: ArrayBuffer[] = [];
    let monospace = /mono|code/i.test(family);
    for (const block of css.split("@font-face").slice(1)) {
        const url = /src:\s*url\(([^)]+)\)/.exec(block)?.[1];
        const weight = Number(/font-weight:\s*(\d+)/.exec(block)?.[1] ?? 400);
        const italic = /font-style:\s*italic/.test(block);
        if (!url || faces.some(face => face.weight === weight && face.italic === italic)) continue;

        const data = await unwrap(Native.downloadFont(url));
        monospace ||= readFontInfo(data.buffer).monospace;
        faces.push({ weight, italic });
        files.push(data.buffer);
    }
    if (!faces.length) throw new Error(`Google Fonts didn't send any files for ${family}`);

    await DataStore.set(filesKey(googleFontId(family)), files);
    return { id: googleFontId(family), name: family, source: "google", faces, monospace, installedAt: Date.now() };
}

export async function installFontFromUrl(url: string): Promise<InstalledFont> {
    const data = await unwrap(Native.downloadFont(url.trim()));
    const info = readFontInfo(data.buffer);
    const id = `url-${Date.now().toString(36)}`;

    await DataStore.set(filesKey(id), [data.buffer]);
    return {
        id,
        name: info.name || url.slice(url.lastIndexOf("/") + 1).replace(/\.\w+$/, ""),
        source: "url",
        url: url.trim(),
        faces: [{ weight: info.weight, italic: info.italic }],
        monospace: info.monospace,
        installedAt: Date.now()
    };
}

export const removeFontFiles = (id: string) => DataStore.del(filesKey(id));

export function describeFaces(font: InstalledFont) {
    const weights = [...new Set(font.faces.map(face => face.weight))].sort((a, b) => a - b);
    return `${weights.join(", ")}${font.faces.some(face => face.italic) ? " · italic" : ""}${font.monospace ? " · monospace" : ""}`;
}

export function groupFont(settings: FontSettings, group: FontGroup) {
    const text = settings.fonts[settings.text];
    if (group === "text") return text;
    return settings.code === "text" ? text : settings.fonts[settings.code];
}

/** Index of the face closest to `weight`, preferring the asked style. */
function closest(faces: FontFile[], weight: number, italic: boolean) {
    const hasStyle = faces.some(face => face.italic === italic);
    let best = -1;
    faces.forEach((face, i) => {
        if (hasStyle && face.italic !== italic) return;
        if (best < 0 || Math.abs(face.weight - weight) < Math.abs(faces[best].weight - weight)) best = i;
    });
    return best;
}

function measure(family: string) {
    const context = document.createElement("canvas").getContext("2d");
    if (!context) return null;
    context.font = `400 100px "${family}"`;
    const x = context.measureText("x");
    const line = context.measureText("Hg");
    return { xHeight: x.actualBoundingBoxAscent, width: context.measureText(SAMPLE).width, lineHeight: line.fontBoundingBoxAscent + line.fontBoundingBoxDescent };
}

/** Scale that brings the font's letters to Discord's size, and the line height factor that follows. */
async function autoMatch(group: FontGroup, files: ArrayBuffer[], font: InstalledFont) {
    const reference = DISCORD_FAMILIES[group][0];
    const probe = new FontFace("Distra Measure", files[closest(font.faces, 400, false)]);
    await Promise.all([probe.load(), document.fonts.load(`400 100px "${reference}"`)]);
    document.fonts.add(probe);
    const [theirs, ours] = [measure(reference), measure("Distra Measure")];
    document.fonts.delete(probe);
    if (!theirs || !ours || !ours.xHeight || !ours.width) return { scale: 1, line: 1 };

    const scale = Math.min(1.4, Math.max(0.6, Math.sqrt(theirs.xHeight / ours.xHeight * (theirs.width / ours.width))));
    return { scale, line: Math.min(1.6, Math.max(0.6, theirs.lineHeight / (ours.lineHeight * scale))) };
}

let registered: FontFace[] = [];
let style: HTMLStyleElement | null = null;

export function clearFonts() {
    registered.forEach(face => document.fonts.delete(face));
    registered = [];
    style?.remove();
    style = null;
}

export async function applyFonts(settings: FontSettings) {
    clearFonts();
    const rules: string[] = [];
    const message = "[id^=\"message-content-\"]".repeat(2);

    for (const group of ["text", "code"] as const) {
        const font = groupFont(settings, group);
        if (!font) continue;
        const files = await DataStore.get<ArrayBuffer[]>(filesKey(font.id));
        if (!files) continue;

        const adjust = settings.adjust[group];
        const matched = adjust.match ? await autoMatch(group, files, font) : { scale: 1, line: 1 };
        const families = [PREVIEW_FAMILY[group]];
        if (settings.scope !== "messages") families.push(...DISCORD_FAMILIES[group], ...(group === "text" && settings.headings ? HEADING_FAMILIES : []));

        for (const family of families) for (const weight of WEIGHTS) for (const italic of [false, true]) {
            const descriptors: FontFaceDescriptors & { sizeAdjust: string; } = {
                weight: String(weight),
                style: italic ? "italic" : "normal",
                sizeAdjust: `${matched.scale * adjust.size}%`
            };
            registered.push(new FontFace(family, files[closest(font.faces, weight + adjust.weight, italic)], descriptors));
        }

        const selector = group === "text" ? message : `${message} code`;
        if (settings.scope === "messages") rules.push(`${selector} { font-family: "${PREVIEW_FAMILY[group]}", var(--font-${group === "text" ? "primary" : "code"}); }`);
        const spacing = adjust.spacing / 100 * matched.line;
        if (group === "text" && spacing !== 1) rules.push(`${message} { line-height: calc(1.375rem * ${spacing}); }`);
    }

    await Promise.all(registered.map(face => face.load()));
    registered.forEach(face => document.fonts.add(face));
    if (rules.length) {
        style = createAndAppendStyle("vc-custom-fonts", document.head);
        style.textContent = rules.join("\n");
    }
}
