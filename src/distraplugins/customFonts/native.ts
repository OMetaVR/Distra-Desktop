/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent, net } from "electron";

const MAX_FONT_SIZE = 30 * 1024 * 1024;

type Result<T> = { success: true; data: T; } | { success: false; error: string; };

async function request<T>(url: string, read: (res: Response) => Promise<T>, init?: RequestInit): Promise<Result<T>> {
    try {
        const res = await net.fetch(url, init);
        if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
        return { success: true, data: await read(res) };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
}

export async function searchGoogleFonts(_: IpcMainInvokeEvent, query: string): Promise<Result<unknown>> {
    if (typeof query !== "string" || query.length > 100) return { success: false, error: "Invalid search" };
    return request("https://fonts.google.com/$rpc/fonts.fe.catalog.actions.metadata.MetadataService/FontSearch", res => res.json(), {
        method: "POST",
        headers: { "content-type": "application/json+protobuf", "x-user-agent": "grpc-web-javascript/0.1" },
        body: JSON.stringify([[query, null, null, null, null, null, 1], [5], null, 16])
    });
}

// Without a browser user agent Google serves one whole TrueType file per face, like Distra for iOS gets.
export async function googleFontCss(_: IpcMainInvokeEvent, family: string): Promise<Result<string>> {
    if (typeof family !== "string" || !/^[\w -]{1,80}$/.test(family)) return { success: false, error: "Invalid font name" };
    const axes = [0, 1].flatMap(italic => [100, 200, 300, 400, 500, 600, 700, 800, 900].map(weight => `${italic},${weight}`)).join(";");
    return request(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:ital,wght@${axes}`, res => res.text(), {
        headers: { "User-Agent": "Distra" }
    });
}

export async function downloadFont(_: IpcMainInvokeEvent, url: string): Promise<Result<Uint8Array<ArrayBuffer>>> {
    if (typeof url !== "string" || !/^https:\/\//i.test(url) || url.length > 2000) return { success: false, error: "Use an https link" };
    return request(url, async res => {
        if (Number(res.headers.get("content-length")) > MAX_FONT_SIZE) throw new Error("The file is too big for a font");
        const data = new Uint8Array(await res.arrayBuffer());
        if (data.byteLength > MAX_FONT_SIZE) throw new Error("The file is too big for a font");
        return data;
    });
}
