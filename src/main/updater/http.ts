/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { VENCORD_USER_AGENT } from "@shared/vencordUserAgent";
import { net } from "electron";
import { existsSync, statSync } from "fs";
import { renameSync, writeFileSync } from "original-fs";
import { join } from "path";

import gitHash from "~git-hash";
import gitRemote from "~git-remote";

import { Updater } from ".";
import { ASAR_FILE } from "./common";

const API_BASE = `https://api.github.com/repos/${gitRemote}`;

function getAsarPath() {
    if (__dirname.endsWith(".asar")) return __dirname;
    const asarPath = join(__dirname, "..", ASAR_FILE);
    if (existsSync(asarPath) && statSync(asarPath).isFile()) return asarPath;
    return join(__dirname, ASAR_FILE);
}

let PendingUpdate: { url: string; hash: string; } | null = null;

// Electron's net.fetch goes through Chromium's network stack, so unlike Node's fetch it uses the system's
// certificates and proxy settings. On Windows, antivirus HTTPS scanning otherwise breaks every update check.
async function request(url: string, headers?: Record<string, string>) {
    let res: Response;
    try {
        res = await net.fetch(url, { headers });
    } catch (err) {
        throw new Error(`Couldn't reach GitHub to check for updates: ${err instanceof Error ? err.message : err}`);
    }

    if (res.ok) return res;

    if ((res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0") {
        const reset = new Date(Number(res.headers.get("x-ratelimit-reset")) * 1000);
        throw new Error(`GitHub limits how often your network can check for updates. Try again after ${reset.toLocaleTimeString()}.`);
    }

    throw new Error(`GET ${url}: ${res.status} ${res.statusText}\n${await res.text().catch(() => "")}`);
}

async function githubGet<T = any>(endpoint: string): Promise<T> {
    const res = await request(API_BASE + endpoint, {
        Accept: "application/vnd.github+json",
        "User-Agent": VENCORD_USER_AGENT
    });
    return res.json();
}

async function listUpdates() {
    const isOutdated = await fetchUpdate();
    if (!isOutdated || !PendingUpdate) return [];

    const data = await githubGet(`/compare/${gitHash}...${PendingUpdate.hash}`);

    return data.commits.map((c: any) => ({
        hash: c.sha,
        author: c.author?.login ?? c.commit?.author?.name ?? "Unknown Author",
        message: c.commit.message.split("\n")[0]
    }));
}

async function fetchUpdate() {
    PendingUpdate = null;
    const releaseData = await githubGet("/releases/latest");
    const tagData = await githubGet(`/git/refs/tags/${releaseData.tag_name}`);

    const releaseHash = tagData.object.sha;
    if (releaseHash === gitHash)
        return false;

    const comparison = await githubGet(`/compare/${gitHash}...${releaseHash}`);
    if (comparison.status !== "ahead") return false;

    const asset = releaseData.assets.find((a: any) => a.name === ASAR_FILE);
    if (!asset) return false;

    PendingUpdate = { url: asset.browser_download_url, hash: releaseHash };
    return true;
}

async function applyUpdate() {
    if (!PendingUpdate) return true;

    const asarPath = getAsarPath();
    const data = Buffer.from(await (await request(PendingUpdate.url)).arrayBuffer());
    const temporaryPath = `${asarPath}.tmp`;
    writeFileSync(temporaryPath, data, { flush: true });
    renameSync(temporaryPath, asarPath);

    PendingUpdate = null;
    return true;
}

const HttpUpdater: Updater = {
    getRepo: async () => `https://github.com/${gitRemote}`,
    listUpdates,
    fetchUpdate,
    applyUpdate
};

export default HttpUpdater;
