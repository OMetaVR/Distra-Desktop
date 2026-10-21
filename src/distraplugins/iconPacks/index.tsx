/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { Logger } from "@utils/Logger";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { useAwaiter } from "@utils/react";
import definePlugin, { OptionType } from "@utils/types";
import { useState } from "@webpack/common";
import type { ReactElement, ReactNode, SVGProps } from "react";

import { downloadPack, getStoredPack, IconPackDefinition, PACKS, packState, PREVIEW_ICONS, previewUrl, removePack, StoredPack } from "./packs";

const cl = classNameFactory("vc-icon-packs-");
const logger = new Logger("IconPacks");

type IconElement = ReactElement<SVGProps<SVGSVGElement> & { children?: ReactNode; }>;
type IconComponent = (props: object) => IconElement;

let iconRegistry: Record<string, unknown> = {};
let packUrls: Map<string, string> | null = null;
let replacements: Map<unknown, string> | null = null;
let rendering = false;

function activate(stored: StoredPack | undefined) {
    packUrls = stored ? new Map(Object.entries(stored.icons).map(([name, blob]) => [name, URL.createObjectURL(blob)])) : null;
    replacements = null;
}

function iconUrl(component: IconComponent) {
    if (!packUrls || rendering) return;
    replacements ??= new Map([...packUrls].map(([name, url]) => [iconRegistry[name], url]));
    return replacements.get(component);
}

const maskStyle = (url: string) => ({ maskImage: `url("${url}")`, maskSize: "contain", maskRepeat: "no-repeat", maskPosition: "center" });

const settings = definePluginSettings({
    pack: {
        type: OptionType.STRING,
        description: "Id of the icon pack in use.",
        default: "",
        hidden: true
    },
    picker: {
        type: OptionType.COMPONENT,
        component: PackPicker
    }
});

function PackPicker() {
    const { pack: activeId } = settings.use(["pack"]);
    const [refresh, setRefresh] = useState(0);
    const [states] = useAwaiter(() => Promise.all(PACKS.map(packState)), { fallbackValue: [], deps: [refresh] });
    const [progress, setProgress] = useState<{ id: string; done: number; total: number; } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [switched, setSwitched] = useState(false);

    async function use(id: string) {
        settings.store.pack = id;
        activate(id ? await getStoredPack(id) : undefined);
        setSwitched(true);
    }

    async function download(pack: IconPackDefinition) {
        setError(null);
        try {
            const stored = await downloadPack(pack, (done, total) => setProgress({ id: pack.id, done, total }));
            if (activeId === pack.id) activate(stored);
            else await use(pack.id);
        } catch (e) {
            logger.error(`Failed to download ${pack.id}`, e);
            setError(`Couldn't download ${pack.name}. ${e instanceof Error ? e.message : ""}`);
        } finally {
            setProgress(null);
            setRefresh(n => n + 1);
        }
    }

    async function remove(pack: IconPackDefinition) {
        if (activeId === pack.id) await use("");
        await removePack(pack.id);
        setRefresh(n => n + 1);
    }

    return (
        <section>
            <Paragraph color="text-muted">
                The same icon packs as Distra for iOS, including Distra's extra icons. Icons a pack doesn't have stay Discord's.
            </Paragraph>

            <div className={classes(cl("packs"), Margins.top16)}>
                <div className={cl("pack", { active: !activeId })}>
                    <div className={cl("header")}>
                        <BaseText size="md" weight="semibold">Discord's icons</BaseText>
                        <Button size="small" variant={activeId ? "secondary" : "positive"} disabled={!activeId} onClick={() => use("")}>
                            {activeId ? "Use" : "In use"}
                        </Button>
                    </div>
                    <BaseText size="sm" color="text-muted">No icon pack.</BaseText>
                </div>

                {PACKS.map((pack, i) => {
                    const state = states[i];
                    const active = activeId === pack.id && state !== "missing";
                    const busy = progress?.id === pack.id;

                    return (
                        <div key={pack.id} className={cl("pack", { active })}>
                            <div className={cl("header")}>
                                <BaseText size="md" weight="semibold">{pack.name}</BaseText>
                                <div className={cl("actions")}>
                                    {state && state !== "missing" && !busy && (
                                        <Button size="small" variant="dangerSecondary" onClick={() => remove(pack)}>Delete</Button>
                                    )}
                                    {state === "installed" ? (
                                        <Button size="small" variant={active ? "positive" : "primary"} disabled={active} onClick={() => use(pack.id)}>
                                            {active ? "In use" : "Use"}
                                        </Button>
                                    ) : (
                                        <Button size="small" disabled={!!progress || !state} onClick={() => download(pack)}>
                                            {busy ? `${progress.done} of ${progress.total}` : state === "outdated" ? "Update" : "Download"}
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <BaseText size="sm" color="text-muted">{pack.description} · {pack.credit}</BaseText>
                            <div className={cl("preview")}>
                                {PREVIEW_ICONS.map(name => (
                                    <span key={name} className={cl("preview-icon")} style={maskStyle(previewUrl(pack, name))} />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {error && <Notice variant="danger" className={Margins.top16}>{error}</Notice>}

            {switched && (
                <Notice
                    className={Margins.top16}
                    action={<Button size="small" variant="secondary" onClick={() => location.reload()}>Reload</Button>}
                >
                    Icons on screen switch as Discord redraws them. Reload Discord to switch them all now.
                </Notice>
            )}
        </section>
    );
}

export default definePlugin({
    name: "IconPacks",
    description: "Replaces Discord's icons with an icon pack, the same packs as Distra for iOS.",
    tags: ["Appearance", "Customisation"],
    authors: [EquicordDevs.mmeta],
    settings,

    patches: [
        {
            find: "AccessibilityIcon:()=>",
            replacement: {
                match: /(?<=\i\.r\((\i)\),)(?=\i\.d\(\1,\{[^}]{0,300}?AccessibilityIcon:\(\)=>)/,
                replace: "$self.setIconRegistry($1),"
            }
        },
        {
            find: '="md",',
            all: true,
            noWarn: true,
            replacement: {
                // Some icons destructure a prop into a variable named like the function itself, so the function is
                // captured in a default parameter, which is evaluated before the body's variables exist.
                match: /function (\i)\((\i)\){(?=let{[^}]{0,200}?size:\i="md")/g,
                replace: "function $1($2,vcIconUnused,vcIcon=$1){if($self.iconUrl(vcIcon))return $self.renderIcon(vcIcon,arguments[0]);"
            }
        }
    ],

    iconUrl,

    setIconRegistry(registry: Record<string, unknown>) {
        iconRegistry = registry;
        replacements = null;
    },

    renderIcon(component: IconComponent, props: object) {
        rendering = true;
        let icon: IconElement;
        try {
            icon = component(props);
        } finally {
            rendering = false;
        }

        const { children, style, ...svgProps } = icon.props;
        const path = (Array.isArray(children) ? children[0] : children)?.props ?? {};

        return (
            <svg {...svgProps} style={{ ...style, ...maskStyle(replacements?.get(component) ?? "") }}>
                <rect width="100%" height="100%" fill={path.fill} className={path.className} />
            </svg>
        );
    },

    async start() {
        if (settings.store.pack) activate(await getStoredPack(settings.store.pack));
    },

    stop() {
        activate(undefined);
    }
});
