/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Heading } from "@components/Heading";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { EquicordDevs, IS_WINDOWS } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { Margins } from "@utils/margins";
import { useAwaiter } from "@utils/react";
import definePlugin, { OptionType } from "@utils/types";
import { findByCodeLazy } from "@webpack";
import { ApplicationStreamingStore, ChannelStore, Constants, MediaEngineStore, RestAPI, SelectedChannelStore, showToast, useStateFromStores } from "@webpack/common";

const cl = classNameFactory("vc-stat-idler-");

const STREAMING_BADGE = 19;

const getDesktopSources = findByCodeLazy("desktop sources");
const startStream = findByCodeLazy('type:"STREAM_START"');
const stopStream = findByCodeLazy('type:"STREAM_STOP"');

const settings = definePluginSettings({
    panel: {
        type: OptionType.COMPONENT,
        component: Panel
    }
});

async function startIdleStream() {
    const channel = ChannelStore.getChannel(SelectedChannelStore.getVoiceChannelId() ?? "");
    if (!channel) throw new Error("Join a voice channel first. An empty one in your own server works.");
    const [source]: { id: string; name: string; }[] = await getDesktopSources(MediaEngineStore.getMediaEngine(), IS_WINDOWS, ["screen"], null) ?? [];
    if (!source) throw new Error("Discord didn't find a screen to stream.");
    startStream(channel.guild_id ?? null, channel.id, { pid: null, sourceId: source.id, sourceName: source.name, audioSourceId: null, sound: false, previewDisabled: true });
}

async function start() {
    try {
        await startIdleStream();
    } catch (e) {
        showToast({ text: e instanceof Error ? e.message : String(e), variant: "critical" });
    }
}

function Progress() {
    const [badge, error, pending] = useAwaiter(async () => {
        const { body } = await RestAPI.get({ url: Constants.Endpoints.USER_BADGES("@me") });
        return (body.badges as { badge_id: number; progress?: { current: number; threshold: number; }[]; info_label?: string; }[])
            .find(stat => stat.badge_id === STREAMING_BADGE) ?? null;
    });

    if (pending) return <Paragraph>Loading your badge progress...</Paragraph>;
    if (error) return <Notice variant="danger">Couldn't load your badge progress.</Notice>;

    const progress = badge?.progress?.[0];
    return (
        <div className={cl("row")}>
            <BaseText size="sm" weight="semibold">Streaming</BaseText>
            <BaseText size="sm">{badge?.info_label ?? (progress ? `${progress.current} of ${progress.threshold}` : "Not on your account yet")}</BaseText>
        </div>
    );
}

function Panel() {
    const stream = useStateFromStores([ApplicationStreamingStore], () => ApplicationStreamingStore.getCurrentUserActiveStream());

    return (
        <section>
            <Notice variant="warning">
                This streams as you on your real account, so people in the call see it. Discord could treat faked activity as abuse, so use it at your own risk.
            </Notice>

            <Heading tag="h4" className={Margins.top16}>Your progress</Heading>
            <Progress />

            <Heading tag="h4" className={Margins.top16}>Streaming</Heading>
            <Paragraph className={Margins.bottom8}>Streams your screen without sound in the voice channel you're in. Discord counts real stream time, so this has to stay running.</Paragraph>
            <div className={cl("actions")}>
                {stream
                    ? <Button variant="dangerSecondary" onClick={() => stopStream([stream.streamType, stream.guildId, stream.channelId, stream.ownerId].filter(Boolean).join(":"))}>Stop streaming</Button>
                    : <Button onClick={start}>Start streaming</Button>}
                {stream && <BaseText size="sm">Streaming in {ChannelStore.getChannel(stream.channelId)?.name ?? "a call"}</BaseText>}
            </div>
        </section>
    );
}

export default definePlugin({
    name: "StatIdler",
    description: "Idles Streaming badge progress by streaming your screen silently in the voice channel you're in.",
    tags: ["Activity", "Utility"],
    authors: [EquicordDevs.mmeta],
    settings
});
