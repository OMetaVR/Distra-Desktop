/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { sleep } from "@utils/misc";

import { PLUMPY_DESKTOP } from "./desktop/plumpy";

// Same packs and ids as Distra for iOS, so the choice can sync between the two.
export interface IconPackDefinition {
    id: string;
    name: string;
    description: string;
    credit: string;
    /** Keep in step with iOS's additionsVersion. */
    additionsVersion: number;
    base?: { repo: string; ref: string; root: string; };
    desktop?: DesktopAdditions;
}

export interface DesktopAdditions {
    /** Bump when these change, so installed packs offer an update. */
    version: number;
    /** Discord desktop icons drawn with one of the pack's icons, or a file from the pack's repo, optionally mirrored. */
    aliases: Record<string, ({ icon: string; } | { file: string; }) & { mirror?: boolean; }>;
    /** Desktop icons drawn for this pack, as SVG. */
    icons: Record<string, string>;
}

const IMAGES_DIR = "design/components/Icon/native/redesign/generated/images";

export const PACKS: IconPackDefinition[] = [
    {
        id: "Plumpy",
        name: "Plumpy",
        description: "Rounded, filled icons",
        credit: "rosiecord (GPL-3.0)",
        additionsVersion: 2,
        base: { repo: "acquitelol/rosiecord", ref: "master", root: "Packs/Plumpy" },
        desktop: PLUMPY_DESKTOP
    },
    {
        id: "Iconsax",
        name: "Iconsax",
        description: "Bold Iconsax icons",
        credit: "Iconsax (MIT)",
        additionsVersion: 1
    }
];

const ADDITIONS_REPO = "OMetaVR/Distra";
const ADDITIONS_REF = "main";
const CONCURRENCY = 12;

export interface StoredPack {
    additionsVersion: number;
    desktopVersion?: number;
    icons: Record<string, Blob>;
}

export type PackState = "missing" | "outdated" | "installed";

const storeKey = (id: string) => `DistraIconPacks_${id}`;

export const getStoredPack = (id: string) => DataStore.get<StoredPack>(storeKey(id));
export const removePack = (id: string) => DataStore.del(storeKey(id));

export async function packState(pack: IconPackDefinition): Promise<PackState> {
    const stored = await getStoredPack(pack.id);
    if (!stored) return "missing";
    return stored.additionsVersion === pack.additionsVersion && (stored.desktopVersion ?? 0) === (pack.desktop?.version ?? 0) ? "installed" : "outdated";
}

const iconName = (path: string) => path.slice(path.lastIndexOf("/") + 1).replace(/@3x\.png$/, "");

async function listIcons(repo: string, ref: string, dir: string, fileUrl: (path: string) => string) {
    const res = await fetch(`https://api.github.com/repos/${repo}/git/trees/${ref}?recursive=1`);
    if (!res.ok) throw new Error(`Couldn't list the icons in ${repo} (HTTP ${res.status})`);
    const { tree }: { tree: { path: string; type: string; }[]; } = await res.json();

    return tree
        .filter(entry => entry.type === "blob" && entry.path.startsWith(`${dir}/`) && entry.path.endsWith("@3x.png"))
        .map(entry => ({ name: iconName(entry.path), url: fileUrl(entry.path) }));
}

async function fetchBlob(name: string, url: string) {
    for (let attempt = 1; ; attempt++) {
        const res = await fetch(url);
        if (res.ok) return res.blob();
        if (attempt === 3) throw new Error(`Couldn't download ${name} (HTTP ${res.status})`);
        await sleep(1000 * attempt);
    }
}

async function mirror(image: Blob) {
    const bitmap = await createImageBitmap(image);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) return image;
    context.scale(-1, 1);
    context.drawImage(bitmap, -bitmap.width, 0);
    return canvas.convertToBlob({ type: "image/png" });
}

export async function downloadPack(pack: IconPackDefinition, onProgress: (done: number, total: number) => void) {
    const { base, desktop } = pack;
    const [baseIcons, additions] = await Promise.all([
        base ? listIcons(base.repo, base.ref, `${base.root}/${IMAGES_DIR}`, path => `https://cdn.jsdelivr.net/gh/${base.repo}@${base.ref}/${path}`) : [],
        listIcons(ADDITIONS_REPO, ADDITIONS_REF, `iconpacks/${pack.id}/${IMAGES_DIR}`, path => `https://raw.githubusercontent.com/${ADDITIONS_REPO}/${ADDITIONS_REF}/${path}`)
    ]);
    const aliasFiles = Object.entries(desktop?.aliases ?? {}).flatMap(([name, alias]) =>
        base && "file" in alias ? [{ name, url: `https://cdn.jsdelivr.net/gh/${base.repo}@${base.ref}/${base.root}/${alias.file}` }] : []);
    const sources = new Map([...baseIcons, ...additions, ...aliasFiles].map(icon => [icon.name, icon.url]));
    if (!sources.size) throw new Error(`${pack.name} has no icons to download`);

    const queue = [...sources];
    const icons: Record<string, Blob> = {};
    let done = 0;
    onProgress(0, queue.length);

    const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
            const [name, url] = next;
            icons[name] = await fetchBlob(name, url);
            onProgress(++done, sources.size);
        }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    for (const [name, alias] of Object.entries(desktop?.aliases ?? {})) {
        const image = icons["icon" in alias ? alias.icon : name];
        if (image) icons[name] = alias.mirror ? await mirror(image) : image;
    }
    for (const [name, svg] of Object.entries(desktop?.icons ?? {}))
        icons[name] ??= new Blob([svg], { type: "image/svg+xml" });

    const stored: StoredPack = { additionsVersion: pack.additionsVersion, desktopVersion: desktop?.version, icons };
    await DataStore.set(storeKey(pack.id), stored);
    return stored;
}

export const PREVIEW_ICONS = ["SettingsIcon", "BellIcon", "ChatIcon", "MicrophoneIcon", "HeadphonesIcon", "FriendsIcon", "GiftIcon", "PencilIcon", "TrashIcon", "MagnifyingGlassIcon"];

export const previewUrl = ({ id, base }: IconPackDefinition, name: string) => base
    ? `https://cdn.jsdelivr.net/gh/${base.repo}@${base.ref}/${base.root}/${IMAGES_DIR}/${name}@3x.png`
    : `https://raw.githubusercontent.com/${ADDITIONS_REPO}/${ADDITIONS_REF}/iconpacks/${id}/${IMAGES_DIR}/${name}@3x.png`;
