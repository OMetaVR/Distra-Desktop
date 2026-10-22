/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { HeadingTertiary } from "@components/Heading";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { EquicordDevs, IS_WINDOWS } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { Margins } from "@utils/margins";
import { useAwaiter } from "@utils/react";
import definePlugin, { OptionType } from "@utils/types";
import { findByCodeLazy, findStoreLazy } from "@webpack";
import { ApplicationStreamingStore, ChannelStore, Constants, FluxDispatcher, lodash, MediaEngineStore, RestAPI, RunningGameStore, SelectedChannelStore, showToast, TextInput, useState, useStateFromStores } from "@webpack/common";

const cl = classNameFactory("vc-stat-idler-");

interface DetectableGame {
    id: string;
    name: string;
    executables?: { os: string; name: string; }[];
}

interface StatBadge {
    badge_id: number;
    progress?: { current: number; threshold: number; }[];
    info_label?: string;
}

const BADGES = [{ id: 20, name: "Game Time" }, { id: 21, name: "Game Variety" }, { id: 19, name: "Streaming" }];

const SelfPresenceStore: { getLocalPresence(): { activities: { name: string; type: number; application_id?: string; }[]; }; } = findStoreLazy("SelfPresenceStore");
const GameStore: { games: Iterable<DetectableGame>; getDetectableGame(id: string): DetectableGame | undefined; } = findStoreLazy("GameStore");
const getDesktopSources = findByCodeLazy("desktop sources");
const startStream = findByCodeLazy('type:"STREAM_START"');
const stopStream = findByCodeLazy('type:"STREAM_STOP"');

const settings = definePluginSettings({
    gameId: {
        type: OptionType.STRING,
        description: "Game to idle for Game Time.",
        default: "",
        hidden: true
    },
    idledGameIds: {
        type: OptionType.CUSTOM,
        description: "Games already played for Game Variety.",
        default: [] as string[],
        hidden: true
    },
    varietyCount: {
        type: OptionType.NUMBER,
        description: "How many new games to add to Game Variety each run.",
        default: 10
    },
    minutesPerGame: {
        type: OptionType.SLIDER,
        description: "Minutes to play each game while adding Game Variety.",
        markers: [5, 10, 15, 30, 60],
        default: 15
    },
    stopWhenPlaying: {
        type: OptionType.BOOLEAN,
        description: "Stop idling when you open a real game, so your real game shows on your profile.",
        default: true
    },
    panel: {
        type: OptionType.COMPONENT,
        component: Panel
    }
});

let fakeGame: { id: string; name: string; pid: number; } | null = null;
let queue: DetectableGame[] = [];
let variety = false;
let switchTimer: ReturnType<typeof setTimeout> | undefined;

function play(game: DetectableGame | null) {
    if (!game) {
        fakeGame = null;
        return FluxDispatcher.dispatch({ type: "RUNNING_GAME_SET_DEBUG_GAME", game: null });
    }
    const seen = RunningGameStore.getGamesSeen(true).find(entry => entry.id === game.id);
    const executable = game.executables?.find(exe => exe.os === "win32") ?? game.executables?.[0];
    const exePath = seen?.exePath ?? `c:/program files/${game.name.toLowerCase()}/${(executable?.name ?? `${game.name}.exe`).replace(/^>/, "")}`;
    const pid = 10000 + Math.floor(Math.random() * 50000);
    fakeGame = { id: game.id, name: game.name, pid };
    FluxDispatcher.dispatch({
        type: "RUNNING_GAME_SET_DEBUG_GAME",
        game: {
            ...fakeGame,
            exePath,
            exeName: exePath.split("/").pop(),
            cmdLine: seen?.cmdLine ?? `"${exePath}"`,
            processName: game.name,
            pidPath: [pid],
            start: Date.now(),
            hidden: false,
            isLauncher: false,
            elevated: false,
            sandboxed: false
        }
    });
}

function stopIdling() {
    clearTimeout(switchTimer);
    queue = [];
    variety = false;
    if (fakeGame) play(null);
}

function playNextInQueue() {
    const game = queue.shift();
    if (!game) return stopIdling();
    play(game);
    switchTimer = setTimeout(() => {
        settings.store.idledGameIds = [...settings.store.idledGameIds, game.id];
        playNextInQueue();
    }, settings.store.minutesPerGame * 60_000);
}

async function idleVariety() {
    const { body } = await RestAPI.get({ url: Constants.Endpoints.USER_ACTIVITY_STATISTICS });
    const played = new Set([...settings.store.idledGameIds, ...(body as { application_id: string; }[]).map(stat => stat.application_id)]);
    const fresh = [...GameStore.games].filter(game => !played.has(game.id) && game.executables?.some(exe => exe.os === "win32"));
    stopIdling();
    if (!fresh.length) throw new Error("There are no games left that you haven't played.");
    queue = lodash.shuffle(fresh).slice(0, settings.store.varietyCount);
    variety = true;
    playNextInQueue();
}

async function startIdleStream() {
    const channel = ChannelStore.getChannel(SelectedChannelStore.getVoiceChannelId() ?? "");
    if (!channel) throw new Error("Join a voice channel first. An empty one in your own server works.");
    const [source]: { id: string; name: string; }[] = await getDesktopSources(MediaEngineStore.getMediaEngine(), IS_WINDOWS, ["screen"], null) ?? [];
    if (!source) throw new Error("Discord didn't find a screen to stream.");
    startStream(channel.guild_id ?? null, channel.id, { pid: null, sourceId: source.id, sourceName: source.name, audioSourceId: null, sound: false, previewDisabled: true });
}

const run = (action: () => unknown) => async () => {
    try {
        await action();
    } catch (e) {
        showToast({ text: e instanceof Error ? e.message : String(e), variant: "critical" });
    }
};

function Progress() {
    const [badges, error, pending] = useAwaiter(async () => {
        const [{ body }, consent] = await Promise.all([
            RestAPI.get({ url: Constants.Endpoints.USER_BADGES("@me") }),
            RestAPI.get({ url: Constants.Endpoints.SETTINGS_CONSENT })
        ]);
        return { stats: new Map((body.badges as StatBadge[]).map(badge => [badge.badge_id, badge])), personalized: consent.body.personalization?.consented !== false };
    });

    if (pending) return <Paragraph>Loading your badge progress...</Paragraph>;
    if (error || !badges) return <Notice variant="danger">Couldn't load your badge progress. Your account may not have these badges yet.</Notice>;

    return (
        <>
            {!badges.personalized && (
                <Notice variant="warning" className={Margins.bottom8}>
                    Discord only counts game time while "Use data to personalize my Discord experience" is on in Data & Privacy.
                </Notice>
            )}
            {BADGES.map(({ id, name }) => {
                const badge = badges.stats.get(id);
                const progress = badge?.progress?.[0];
                return (
                    <div key={id} className={cl("row")}>
                        <BaseText size="sm" weight="semibold">{name}</BaseText>
                        <BaseText size="sm">{badge?.info_label ?? (progress ? `${progress.current} of ${progress.threshold}` : "Not on your account yet")}</BaseText>
                    </div>
                );
            })}
        </>
    );
}

const GAME_KEYS: (keyof typeof settings.store)[] = ["gameId"];

function GamePicker() {
    const { gameId } = settings.use(GAME_KEYS);
    const [query, setQuery] = useState("");
    const needle = query.trim().toLowerCase();
    const results = needle ? [...GameStore.games].filter(game => game.name.toLowerCase().includes(needle)).slice(0, 6) : [];

    return (
        <>
            <TextInput value={query} onChange={setQuery} placeholder={GameStore.getDetectableGame(gameId)?.name ?? "Search for a game"} />
            <div className={cl("results")}>
                {results.map(game => (
                    <Button key={game.id} size="small" variant={game.id === gameId ? "primary" : "secondary"} onClick={() => { settings.store.gameId = game.id; setQuery(""); }}>
                        {game.name}
                    </Button>
                ))}
            </div>
        </>
    );
}

const PANEL_KEYS: (keyof typeof settings.store)[] = ["gameId", "varietyCount", "minutesPerGame"];

function Panel() {
    const { gameId, varietyCount, minutesPerGame } = settings.use(PANEL_KEYS);
    const playing = useStateFromStores([RunningGameStore], () => RunningGameStore.getRunningGames().some(game => game.pid === fakeGame?.pid) ? fakeGame : null);
    const hidden = useStateFromStores([RunningGameStore], () => playing != null && !RunningGameStore.getVisibleRunningGames().some(game => game.pid === playing.pid), [playing]);
    const shadowedBy = useStateFromStores([SelfPresenceStore], () => {
        const { activities } = SelfPresenceStore.getLocalPresence();
        return playing && !hidden && !activities.some(activity => activity.application_id === playing.id) ? activities.find(activity => activity.type === 0)?.name ?? null : null;
    }, [playing, hidden]);
    const stream = useStateFromStores([ApplicationStreamingStore], () => ApplicationStreamingStore.getCurrentUserActiveStream());

    return (
        <section className={cl("panel")}>
            <Notice variant="warning">
                This plays games and streams as you on your real account, so friends see them on your profile. Discord could treat faked activity as abuse, so use it at your own risk.
            </Notice>

            <HeadingTertiary className={Margins.top16}>Your progress</HeadingTertiary>
            <Progress />

            <HeadingTertiary className={Margins.top16}>Game Time</HeadingTertiary>
            <Paragraph className={Margins.bottom8}>Plays one game for as long as you leave it running. Discord adds the time when you stop.</Paragraph>
            <GamePicker />
            <div className={cl("actions")}>
                {playing && !variety
                    ? <Button variant="dangerSecondary" onClick={stopIdling}>Stop idling</Button>
                    : <Button disabled={!gameId} onClick={() => { stopIdling(); play(GameStore.getDetectableGame(gameId) ?? null); }}>Start idling</Button>}
                {playing && !variety && <BaseText size="sm">Playing {playing.name}</BaseText>}
            </div>
            {shadowedBy && (
                <Notice variant="info" className={Margins.top8}>
                    Discord only shows one Playing status and {shadowedBy} is using it, so friends won't see {playing?.name}. The time still counts.
                </Notice>
            )}
            {hidden && (
                <Notice variant="warning" className={Margins.top8}>
                    You turned off detection for {playing?.name} in Registered Games, so Discord won't count it. Pick another game or turn detection back on.
                </Notice>
            )}

            <HeadingTertiary className={Margins.top16}>Game Variety</HeadingTertiary>
            <Paragraph className={Margins.bottom8}>
                Plays {varietyCount} games you've never played, {minutesPerGame} minutes each. Discord keeps every game you've played, so the count only goes up.
            </Paragraph>
            <div className={cl("actions")}>
                {playing && variety
                    ? <Button variant="dangerSecondary" onClick={stopIdling}>Stop adding games</Button>
                    : <Button onClick={run(idleVariety)}>Add games</Button>}
                {playing && variety && <BaseText size="sm">Playing {playing.name}, {queue.length} more after this</BaseText>}
            </div>

            <HeadingTertiary className={Margins.top16}>Streaming</HeadingTertiary>
            <Paragraph className={Margins.bottom8}>Streams your screen without sound in the voice channel you're in. Discord counts real stream time, so this has to stay running.</Paragraph>
            <div className={cl("actions")}>
                {stream
                    ? <Button variant="dangerSecondary" onClick={() => stopStream([stream.streamType, stream.guildId, stream.channelId, stream.ownerId].filter(Boolean).join(":"))}>Stop streaming</Button>
                    : <Button onClick={run(startIdleStream)}>Start streaming</Button>}
                {stream && <BaseText size="sm">Streaming in {ChannelStore.getChannel(stream.channelId)?.name ?? "a call"}</BaseText>}
            </div>
        </section>
    );
}

export default definePlugin({
    name: "StatIdler",
    description: "Idles Game Time, Game Variety and Streaming badge progress on your real profile without opening games.",
    tags: ["Activity", "Utility"],
    authors: [EquicordDevs.mmeta],
    settings,

    flux: {
        RUNNING_GAMES_CHANGE({ games }: { games: { pid: number; name: string; hidden?: boolean; isLauncher?: boolean; }[]; }) {
            const real = fakeGame && games.find(game => game.pid !== fakeGame?.pid && !game.hidden && !game.isLauncher);
            if (!real || !settings.store.stopWhenPlaying) return;
            stopIdling();
            showToast({ text: `Stopped idling because you opened ${real.name}.` });
        }
    },

    stop: stopIdling
});
