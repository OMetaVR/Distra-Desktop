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
import { classNameFactory, createAndAppendStyle } from "@utils/css";
import { Logger } from "@utils/Logger";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { useAwaiter } from "@utils/react";
import definePlugin, { OptionType, StartAt } from "@utils/types";
import { useState } from "@webpack/common";
import type { ComponentType, ReactElement, ReactNode, SVGProps } from "react";

import { downloadPack, getStoredPack, IconPackDefinition, PACKS, packState, PREVIEW_ICONS, previewUrl, removePack, StoredPack } from "./packs";

const cl = classNameFactory("vc-icon-packs-");
const logger = new Logger("IconPacks");

type IconElement = ReactElement<SVGProps<SVGSVGElement> & { children?: ReactNode; }>;
type IconComponent = (props: object) => IconElement;

let iconRegistry: Record<string, unknown> = {};
let packUrls: Map<string, string> | null = null;
let replacements: Map<unknown, string> | null = null;
let rendering = false;
let pluginIconStyle: HTMLStyleElement | null = null;

// Plugins draw their own icons, so these are matched by their buttons and drawn with the pack's icon for the same thing.
const PLUGIN_ICONS: { selector: string; icon: string; slash?: boolean; color?: string; }[] = [
    { selector: '[aria-label="Disable Game Activity"]', icon: "GameControllerIcon" },
    { selector: '[aria-label="Enable Game Activity"]', icon: "GameControllerIcon", slash: true, color: "var(--status-danger)" },
    { selector: '[aria-label^="Typing Visible"]', icon: "KeyboardIcon" },
    { selector: '[aria-label^="Typing Hidden"]', icon: "KeyboardIcon", slash: true },
    { selector: '[aria-label="Open Translate Modal"]', icon: "LanguageIcon" },
    { selector: '[aria-label="Encrypt Message"]', icon: "LockIcon" },
    { selector: '[aria-label^="Schedule Mode OFF"]', icon: "CalendarIcon" },
    { selector: '[aria-label^="Schedule Mode ON"]', icon: "CalendarIcon", color: "var(--status-positive)" },
    { selector: '[aria-label="Favorite Images"]', icon: "ImageIcon" },
    { selector: '[aria-label="Favorite Videos"]', icon: "VideoIcon" }
];

const svgUrl = (inner: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${inner}</svg>`)}")`;
const SLASH = "M3.6 20.4 20.4 3.6";
const SLASH_LINE = (color: string) => svgUrl(`<path d="${SLASH}" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>`);
const SLASH_CUT = svgUrl(`<mask id="m"><rect width="24" height="24" fill="#fff"/><path d="${SLASH}" stroke="#000" stroke-width="6" stroke-linecap="round"/></mask><rect width="24" height="24" mask="url(#m)"/>`);
const layer = (image: string, composite = "") => `${image} center / contain no-repeat ${composite}`;

function pluginIconCss(urls: Map<string, string>) {
    return PLUGIN_ICONS.filter(({ icon }) => urls.has(icon)).map(({ selector, icon, slash, color = "currentColor" }) => {
        const image = `url("${urls.get(icon)}")`;
        const mask = slash ? [layer(SLASH_LINE("#000"), "add"), layer(image, "intersect"), layer(SLASH_CUT)].join(", ") : layer(image);
        const background = slash ? `${layer(SLASH_LINE("#f23f43"))}, ${color}` : color;
        return `${selector} svg { background: ${background}; mask: ${mask}; }\n${selector} svg > * { display: none; }`;
    }).join("\n");
}

function activate(stored: StoredPack | undefined) {
    packUrls = stored ? new Map(Object.entries(stored.icons).map(([name, blob]) => [name, URL.createObjectURL(blob)])) : null;
    replacements = null;

    pluginIconStyle?.remove();
    pluginIconStyle = null;
    if (!packUrls) return;
    const css = pluginIconCss(packUrls);
    const addStyle = () => {
        pluginIconStyle = createAndAppendStyle("vc-icon-packs-plugin-icons", document.head);
        pluginIconStyle.textContent = css;
    };
    if (document.head) addStyle();
    else document.addEventListener("DOMContentLoaded", addStyle, { once: true });
}

interface LottieProps {
    src: () => unknown;
    markers: Record<string, unknown>;
    initialAnimation?: string;
    size?: string;
    width?: number;
    height?: number;
    color?: unknown;
    className?: string;
}

// Discord animates some icons with Lottie instead of icon components; these are drawn with the pack's still icon.
// Single state animations are told apart by the webpack module of their animation data.
const LOTTIE_ICONS: Record<string, string> = {
    29597: "SettingsIcon",
    640114: "GiftIcon",
    582636: "GifIcon",
    279825: "StickerIcon",
    695941: "AppsIcon"
};

function lottieIconName({ src, markers, initialAnimation }: LottieProps) {
    if ("unmute" in markers) return initialAnimation === "unmute" ? "MicrophoneSlashIcon" : "MicrophoneIcon";
    if ("undeafen" in markers) return initialAnimation === "undeafen" ? "HeadphonesSlashIcon" : "HeadphonesIcon";
    const module = /\.bind\(\w+,(\d+),/.exec(String(src))?.[1];
    return module && LOTTIE_ICONS[module];
}

const isComponent = (value: unknown): value is ComponentType<Record<string, unknown>> => typeof value === "function";

function paintOf(children: ReactNode) {
    for (const child of [children].flat(Infinity)) {
        if (!child || typeof child !== "object" || !("props" in child)) continue;
        const { fill, className } = child.props as SVGProps<SVGElement>;
        if (typeof fill === "string" && fill !== "none" && fill !== "transparent") return { fill, className };
    }
    return { fill: "currentColor", className: undefined };
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
            find: '"lottie_hover_multiple_loop"',
            replacement: {
                match: /(?=return\(0,\i\.jsx\)\("div",\{style:)/,
                replace: "const vcPackIcon=$self.lottieIcon(arguments[0]);if(vcPackIcon)return vcPackIcon;"
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
        const paint = paintOf(children);

        return (
            <svg {...svgProps} style={{ ...style, ...maskStyle(replacements?.get(component) ?? "") }}>
                <rect width="100%" height="100%" fill={paint.fill} className={paint.className} />
            </svg>
        );
    },

    lottieIcon(props: LottieProps) {
        const name = lottieIconName(props);
        const Icon = name && packUrls?.has(name) ? iconRegistry[name] : undefined;
        if (!isComponent(Icon)) return null;
        const size = props.size === "custom" ? { size: "custom", width: props.width, height: props.height } : { size: props.size };
        return <Icon {...size} color={props.color} className={props.className} />;
    },

    // Early, so the pack is ready before Discord draws its first icons.
    startAt: StartAt.Init,

    async start() {
        if (settings.store.pack) activate(await getStoredPack(settings.store.pack));
    },

    stop() {
        activate(undefined);
    }
});
