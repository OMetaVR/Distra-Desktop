/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { ApplicationCommandInputType, ApplicationCommandOptionType, commands as registeredCommands, findOption, sendBotMessage } from "@api/Commands";
import { isPluginEnabled, isPluginRequired } from "@api/PluginManager";
import { useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Card } from "@components/Card";
import ErrorBoundary from "@components/ErrorBoundary";
import { WarningIcon } from "@components/Icons";
import { AddonCard } from "@components/settings";
import { PluginCard } from "@components/settings/tabs/plugins/PluginCard";
import { TooltipContainer } from "@components/TooltipContainer";
import { gitHashShort } from "@shared/vencordUserAgent";
import { EquicordDevs, IS_MAC, IS_WINDOWS } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { sendMessage } from "@utils/discord";
import definePlugin from "@utils/types";
import { CommandContext, Message } from "@vencord/discord-types";
import { ChannelType } from "@vencord/discord-types/enums";
import { Alerts, SettingsRouter, showToast, UserStore } from "@webpack/common";

import plugins, { PluginMeta } from "~plugins";

const cl = classNameFactory("vc-distra-helper-");

// Only messages from this account turn into cards, and only this account gets the commands.
const OWNER_ID = String(EquicordDevs.mmeta.id);

// The last line of every helper message. Clients without Distra just show it as small text.
const MARKER = /^-# Distra · (plugin|update|open|debug)(?::(.+))?$/m;

const SECTIONS = {
    distra: { key: "equicord_main_panel", label: "Distra settings" },
    plugins: { key: "equicord_plugins_panel", label: "Plugins" },
    themes: { key: "equicord_themes_panel", label: "Themes" },
    updater: { key: "equicord_updater_panel", label: "Updater" },
    cloud: { key: "equicord_cloud_panel", label: "Cloud" },
    backup: { key: "equicord_backup_restore_panel", label: "Backup & Restore" },
} as const;

type SectionId = keyof typeof SECTIONS;

const isOwner = () => UserStore.getCurrentUser()?.id === OWNER_ID;

// Equicord's support commands, which normally only work in Equicord's server, also work in DMs with mmeta.
const SUPPORT_COMMANDS = ["equicord-debug", "equicord-plugins"];
const originalPredicates = new Map<string, ((ctx: CommandContext) => boolean) | undefined>();

const isDmWithOwner = (ctx: CommandContext) =>
    (ctx.channel.type === ChannelType.DM || ctx.channel.type === ChannelType.GROUP_DM) && ctx.channel.recipients.includes(OWNER_ID);

function findPlugin(name: string) {
    const lower = name.trim().toLowerCase();
    return Object.keys(plugins).find(p => p.toLowerCase() === lower);
}

function withNote(note: string | undefined, body: string) {
    return note?.trim() ? `${note.trim()}\n${body}` : body;
}

// --- Cards shown under helper messages ---

function ChatPluginCard({ name }: { name: string; }) {
    const pluginName = findPlugin(name);
    useSettings([`plugins.${pluginName ?? name}.enabled`]);
    const plugin = pluginName ? plugins[pluginName] : undefined;

    if (!plugin) {
        return (
            <TooltipContainer text="This plugin isn't in your version of Distra. Try updating!">
                <AddonCard name={name} description="Not in your version of Distra." enabled={false} setEnabled={() => { }} disabled infoButton={<WarningIcon />} />
            </TooltipContainer>
        );
    }

    return (
        <PluginCard
            plugin={plugin}
            disabled={isPluginRequired(plugin.name)}
            onRestartNeeded={() => showToast({ text: "Restart Discord for this change to take effect." })}
        />
    );
}

function PromptCard({ title, body, action, onAction }: { title: string; body: string; action: string; onAction(): void; }) {
    return (
        <Card className={cl("prompt")} defaultPadding>
            <div className={cl("prompt-text")}>
                <span className={cl("prompt-title")}>{title}</span>
                <span className={cl("prompt-body")}>{body}</span>
            </div>
            <Button size="small" onClick={onAction}>{action}</Button>
        </Card>
    );
}

function buildDate() {
    return new Date(BUILD_TIMESTAMP).toLocaleDateString(undefined, { dateStyle: "medium" });
}

const HelperCards = ErrorBoundary.wrap(function HelperCards({ message }: { message: Message; }) {
    if (message.author?.id !== OWNER_ID) return null;
    const match = MARKER.exec(message.content ?? "");
    if (!match) return null;
    const [, kind, arg = ""] = match;

    switch (kind) {
        case "plugin": {
            const names = [...new Set(arg.split(",").map(n => n.trim()).filter(Boolean))].slice(0, 10);
            return (
                <div className={`vc-plugins-management-cards vc-plugins-grid ${cl("plugins")}`}>
                    {names.map(n => <ChatPluginCard key={n} name={n} />)}
                </div>
            );
        }
        case "update":
            return (
                <PromptCard
                    title="Check for a Distra update"
                    body={`You're on build ${gitHashShort} from ${buildDate()}.`}
                    action="Open Updater"
                    onAction={() => SettingsRouter.openUserSettings(SECTIONS.updater.key)}
                />
            );
        case "open": {
            const section = SECTIONS[arg as SectionId];
            if (!section) return null;
            return (
                <PromptCard
                    title={`Open ${section.label}`}
                    body="This opens the right page in your Distra settings."
                    action={`Open ${section.label}`}
                    onAction={() => SettingsRouter.openUserSettings(section.key)}
                />
            );
        }
        case "debug":
            return (
                <PromptCard
                    title="Share your debug info"
                    body="Sends your Distra build, Discord build, platform and enabled plugins to this chat, after you confirm."
                    action="Send debug info"
                    onAction={() => confirmSendDebugInfo(message.channel_id)}
                />
            );
    }
    return null;
}, { noop: true });

// --- Debug info ---

function debugInfo() {
    const { RELEASE_CHANNEL } = window.GLOBAL_ENV;
    const enabled = Object.keys(plugins).filter(p => !plugins[p].required && !plugins[p].hidden && isPluginEnabled(p)).sort();
    const distraPlugins = enabled.filter(p => PluginMeta[p]?.distraPlugin);
    const info = [
        `**Distra**: v${VERSION} • ${gitHashShort} • built ${buildDate()}`,
        `**Discord**: ${RELEASE_CHANNEL}${IS_DISCORD_DESKTOP ? " (desktop)" : IS_WEB ? " (web)" : ""}`,
        `**Platform**: ${IS_WINDOWS ? "Windows" : IS_MAC ? "macOS" : "Linux"}`,
        `**Enabled plugins**: ${enabled.length}${distraPlugins.length ? ` (Distra: ${distraPlugins.join(", ")})` : ""}`,
    ];
    return { summary: `>>> ${info.join("\n")}`, pluginList: enabled.join(", ") };
}

function confirmSendDebugInfo(channelId: string) {
    Alerts.show({
        title: "Send your debug info?",
        body: "This posts your Distra version, Discord build, platform and the names of your enabled plugins in this chat.",
        confirmText: "Send",
        cancelText: "Cancel",
        onConfirm() {
            const { summary, pluginList } = debugInfo();
            sendMessage(channelId, { content: summary });
            // Discord caps messages at 2000 characters, so long plugin lists go out in chunks.
            for (let i = 0; i < pluginList.length; i += 1900) {
                sendMessage(channelId, { content: "```\n" + pluginList.slice(i, i + 1900) + "\n```" });
            }
        }
    });
}

// --- Commands ---

const noteOption = {
    name: "note",
    description: "Text to put above it",
    type: ApplicationCommandOptionType.STRING,
    required: false
};

export default definePlugin({
    name: "DistraHelper",
    description: "Shows plugin cards and quick actions under Distra help messages from mmeta, gives mmeta the commands that send them, and lets the support commands work in DMs with mmeta.",
    authors: [EquicordDevs.mmeta],
    enabledByDefault: true,

    renderMessageAccessory: props => <HelperCards message={props.message} />,

    start() {
        for (const name of SUPPORT_COMMANDS) {
            const command = registeredCommands[name];
            if (!command || originalPredicates.has(name)) continue;
            const original = command.predicate;
            originalPredicates.set(name, original);
            command.predicate = ctx => (original?.(ctx) ?? true) || isDmWithOwner(ctx);
        }
    },

    stop() {
        for (const [name, original] of originalPredicates) {
            const command = registeredCommands[name];
            if (command) command.predicate = original;
        }
        originalPredicates.clear();
    },

    commands: [
        {
            name: "plugindisplay",
            description: "Send plugin cards that Distra users can toggle right in chat",
            inputType: ApplicationCommandInputType.BUILT_IN,
            predicate: isOwner,
            options: [
                {
                    name: "plugins",
                    description: "Plugin names, separated by commas",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                },
                noteOption
            ],
            execute(args, ctx) {
                const requested = findOption<string>(args, "plugins", "").split(",").map(s => s.trim()).filter(Boolean);
                const found = requested.map(findPlugin);
                const missing = requested.filter((_, i) => !found[i]);
                if (missing.length) {
                    const hints = missing.map(m => {
                        const close = Object.keys(plugins).filter(p => p.toLowerCase().includes(m.toLowerCase())).slice(0, 5);
                        return `**${m}**${close.length ? `: did you mean ${close.join(", ")}?` : ""}`;
                    });
                    sendBotMessage(ctx.channel.id, { content: `Couldn't find:\n${hints.join("\n")}` });
                    return;
                }
                const names = [...new Set(found as string[])];
                const lines = names.map(n => `**${n}** · ${plugins[n].description}`);
                sendMessage(ctx.channel.id, { content: withNote(findOption(args, "note"), `${lines.join("\n")}\n-# Distra · plugin:${names.join(",")}`) });
            }
        },
        {
            name: "updateprompt",
            description: "Ask a Distra user to update, with a button to their updater",
            inputType: ApplicationCommandInputType.BUILT_IN,
            predicate: isOwner,
            options: [noteOption],
            execute(args, ctx) {
                sendMessage(ctx.channel.id, { content: withNote(findOption(args, "note") ?? "Your Distra might be out of date.", "-# Distra · update") });
            }
        },
        {
            name: "settingsprompt",
            description: "Send a button that opens a page of a Distra user's settings",
            inputType: ApplicationCommandInputType.BUILT_IN,
            predicate: isOwner,
            options: [
                {
                    name: "section",
                    description: "Which page to open",
                    type: ApplicationCommandOptionType.STRING,
                    required: true,
                    choices: Object.entries(SECTIONS).map(([value, { label }]) => ({ name: value, label, displayName: label, value }))
                },
                noteOption
            ],
            execute(args, ctx) {
                const section = findOption<string>(args, "section", "distra") as SectionId;
                sendMessage(ctx.channel.id, { content: withNote(findOption(args, "note"), `-# Distra · open:${section}`) });
            }
        },
        {
            name: "debugrequest",
            description: "Ask a Distra user to share their debug info with one click",
            inputType: ApplicationCommandInputType.BUILT_IN,
            predicate: isOwner,
            options: [noteOption],
            execute(args, ctx) {
                sendMessage(ctx.channel.id, { content: withNote(findOption(args, "note") ?? "Could you send me your Distra debug info?", "-# Distra · debug") });
            }
        }
    ]
});
