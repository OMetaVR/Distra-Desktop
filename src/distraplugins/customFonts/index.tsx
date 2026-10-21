/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { FormSwitch } from "@components/FormSwitch";
import { HeadingTertiary } from "@components/Heading";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { Logger } from "@utils/Logger";
import { Margins } from "@utils/margins";
import definePlugin, { OptionType } from "@utils/types";
import { Select, Slider, TextInput, useEffect, useState } from "@webpack/common";

import { applyFonts, clearFonts, defaultAdjust, describeFaces, FontAdjust, FontGroup, FontSettings, googleFontId, groupFont, InstalledFont, installFontFromUrl, installGoogleFont, removeFontFiles, searchGoogleFonts, SUGGESTED } from "./fonts";

const cl = classNameFactory("vc-custom-fonts-");
const logger = new Logger("CustomFonts");
const SAMPLE = "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.";
const KEYS: (keyof FontSettings)[] = ["fonts", "text", "code", "headings", "scope", "adjust"];

const settings = definePluginSettings({
    fonts: { type: OptionType.CUSTOM, description: "Installed fonts.", default: {} as Record<string, InstalledFont> },
    text: { type: OptionType.STRING, description: "Text font.", default: "", hidden: true },
    code: { type: OptionType.STRING, description: "Code font.", default: "", hidden: true },
    headings: { type: OptionType.BOOLEAN, description: "Also replace the heading font.", default: true, hidden: true },
    scope: {
        type: OptionType.SELECT,
        description: "Where the fonts apply.",
        options: [{ label: "Everywhere", value: "app", default: true }, { label: "Messages only", value: "messages" }] as const,
        hidden: true
    },
    adjust: { type: OptionType.CUSTOM, description: "Size, weight and line spacing of each font.", default: { text: { ...defaultAdjust }, code: { ...defaultAdjust } } as Record<FontGroup, FontAdjust> },
    page: { type: OptionType.COMPONENT, component: FontsPage }
});

const apply = () => applyFonts(settings.store).catch(e => logger.error("Couldn't apply fonts", e));

function AdjustPanel({ group, font }: { group: FontGroup; font: InstalledFont; }) {
    const adjust = settings.use(["adjust"]).adjust[group];
    const set = (change: Partial<FontAdjust>) => {
        settings.store.adjust[group] = { ...adjust, ...change };
        apply();
    };

    return (
        <div className={cl("panel")}>
            <HeadingTertiary>{group === "text" ? "Text" : "Code"} font: {font.name}</HeadingTertiary>
            <FormSwitch
                title={`Match ${group === "text" ? "gg sans" : "gg mono"}'s size`}
                description="Scales the font so its letters are about as tall and wide as Discord's font."
                value={adjust.match}
                onChange={match => set({ match })}
                hideBorder
            />
            <BaseText size="sm" weight="medium">{adjust.match ? "Size (after matching)" : "Size"}</BaseText>
            <Slider initialValue={adjust.size} minValue={70} maxValue={150} markers={[70, 80, 90, 100, 110, 120, 130, 140, 150]} stickToMarkers={false} onValueRender={v => `${Math.round(v)}%`} onValueChange={v => set({ size: Math.round(v) })} />
            <BaseText size="sm" weight="medium">Weight</BaseText>
            <Slider initialValue={adjust.weight} minValue={-200} maxValue={200} markers={[-200, -100, 0, 100, 200]} stickToMarkers onMarkerRender={v => <span className={cl("marker")}>{v > 0 ? `+${v}` : v}</span>} onValueChange={weight => set({ weight })} />
            <BaseText size="sm" weight="medium">Line spacing</BaseText>
            <Slider initialValue={adjust.spacing} minValue={80} maxValue={200} markers={[80, 100, 120, 140, 160, 180, 200]} stickToMarkers={false} onValueRender={v => `${Math.round(v)}%`} onValueChange={v => set({ spacing: Math.round(v) })} />
            <div className={cl("sample", group)}>{SAMPLE}</div>
        </div>
    );
}

function FontsPage() {
    const state = settings.use(KEYS);
    const fonts = Object.values(state.fonts).sort((a, b) => a.name.localeCompare(b.name));
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<string[] | null>(null);
    const [link, setLink] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!query.trim()) return setResults(null);
        const timer = setTimeout(() => searchGoogleFonts(query.trim()).then(setResults, () => setResults([])), 300);
        return () => clearTimeout(timer);
    }, [query]);

    function choose(group: FontGroup, id: string) {
        settings.store[group] = id;
        apply();
    }

    async function install(what: string, installer: () => Promise<InstalledFont>) {
        setBusy(what);
        setError(null);
        try {
            const font = await installer();
            settings.store.fonts[font.id] = font;
            if (!settings.store.text) choose("text", font.id);
        } catch (e) {
            setError(`Couldn't install ${what}. ${e instanceof Error ? e.message : ""}`);
        } finally {
            setBusy(null);
        }
    }

    async function remove(font: InstalledFont) {
        delete settings.store.fonts[font.id];
        if (settings.store.text === font.id) settings.store.text = "";
        if (settings.store.code === font.id) settings.store.code = "";
        await removeFontFiles(font.id);
        apply();
    }

    const familyRow = (family: string) => {
        const installed = !!state.fonts[googleFontId(family)];
        return (
            <div key={family} className={cl("row")}>
                <BaseText size="md">{family}</BaseText>
                <Button size="small" variant="secondary" disabled={installed || !!busy} onClick={() => install(family, () => installGoogleFont(family))}>
                    {busy === family ? "Installing..." : installed ? "Installed" : "Install"}
                </Button>
            </div>
        );
    };

    const textFont = groupFont(state, "text");
    const codeFont = groupFont(state, "code");

    return (
        <section className={cl("page")}>
            {isPluginEnabled("FontLoader") && (
                <Notice variant="warning">FontLoader is also on and overrides these fonts. Turn it off to use CustomFonts.</Notice>
            )}

            <div className={cl("pickers")}>
                <div>
                    <BaseText size="sm" weight="medium">Text font</BaseText>
                    <Select
                        options={[{ label: "Discord's (gg sans)", value: "" }, ...fonts.map(font => ({ label: font.name, value: font.id }))]}
                        isSelected={v => v === state.text}
                        select={v => choose("text", v)}
                        serialize={String}
                    />
                </div>
                <div>
                    <BaseText size="sm" weight="medium">Code font</BaseText>
                    <Select
                        options={[
                            { label: "Discord's (gg mono)", value: "" },
                            { label: "Same as the text font", value: "text" },
                            ...fonts.filter(font => font.monospace).map(font => ({ label: font.name, value: font.id }))
                        ]}
                        isSelected={v => v === state.code}
                        select={v => choose("code", v)}
                        serialize={String}
                    />
                </div>
            </div>

            {textFont && <AdjustPanel group="text" font={textFont} />}
            {codeFont && state.code !== "text" && <AdjustPanel group="code" font={codeFont} />}

            <FormSwitch
                title="Headings too"
                description="Also replace the bold heading font Discord uses for big titles."
                value={state.headings}
                onChange={headings => { settings.store.headings = headings; apply(); }}
            />
            <div>
                <BaseText size="sm" weight="medium">Apply to</BaseText>
                <Select
                    options={[
                        { label: "Everywhere: messages and the rest of the app", value: "app" },
                        { label: "Messages only", value: "messages" }
                    ]}
                    isSelected={v => v === state.scope}
                    select={v => { settings.store.scope = v; apply(); }}
                    serialize={String}
                />
            </div>

            {error && <Notice variant="danger">{error}</Notice>}

            <HeadingTertiary className={Margins.top8}>Add fonts</HeadingTertiary>
            <div className={cl("row")}>
                <TextInput value={link} onChange={setLink} placeholder="Link to a .ttf or .otf file" />
                <Button size="small" disabled={!link.trim() || !!busy} onClick={() => install("that font", () => installFontFromUrl(link)).then(() => setLink(""))}>
                    {busy === "that font" ? "Installing..." : "Install"}
                </Button>
            </div>
            <TextInput value={query} onChange={setQuery} placeholder="Search Google Fonts" />
            <div className={cl("list")}>
                {results
                    ? results.length ? results.slice(0, 20).map(familyRow) : <Paragraph color="text-muted">No fonts found.</Paragraph>
                    : SUGGESTED.map(familyRow)}
            </div>

            {fonts.length > 0 && (
                <>
                    <HeadingTertiary className={Margins.top8}>Installed</HeadingTertiary>
                    <div className={cl("list")}>
                        {fonts.map(font => (
                            <div key={font.id} className={cl("row")}>
                                <div>
                                    <BaseText size="md">{font.name}</BaseText>
                                    <BaseText size="xs" color="text-muted">{describeFaces(font)}</BaseText>
                                </div>
                                <Button size="small" variant="dangerSecondary" onClick={() => remove(font)}>Delete</Button>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}

export default definePlugin({
    name: "CustomFonts",
    description: "Use any Google Font, or a .ttf or .otf from a link, for Discord's text, headings and code, each with its own size, weight and line spacing. The same as Distra for iOS's Font Loader.",
    tags: ["Appearance", "Customisation"],
    authors: [EquicordDevs.mmeta, EquicordDevs.vmohammad],
    settings,
    start: apply,
    stop: clearFonts
});
