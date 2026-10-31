/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { ProfileBadge } from "@api/Badges";
import { definePluginSettings } from "@api/Settings";
import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Heading } from "@components/Heading";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { fetchUserProfile } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { Margins } from "@utils/margins";
import { pluralise } from "@utils/misc";
import { useAwaiter } from "@utils/react";
import definePlugin, { OptionType } from "@utils/types";
import { filters, mapMangledModuleLazy } from "@webpack";
import { Alerts, Clickable, Constants, FluxDispatcher, RestAPI, showToast, Tooltip, UserProfileStore, UserStore, useState, useStateFromStores } from "@webpack/common";

import { BADGE_GROUPS, badgeIconUrl, decodeBadges, encodeBadges, FakeBadge, stripBadges } from "./badges";

// Discord is rolling out a longer About Me (300 instead of 190) behind an experiment, so ask it for the limit.
const BioLength = mapMangledModuleLazy('"2026-08-user-bio-max-length"', {
    getMaxLength: filters.byCode(".getConfig(")
});

function bioMaxLength(): number {
    try {
        return BioLength.getMaxLength({ location: "FakeBadges" }) ?? 190;
    } catch {
        return 190;
    }
}

const cl = classNameFactory("vc-fake-badges-");
const logger = new Logger("FakeBadges");

const fakeName = (badge: FakeBadge) => `${badge.name} (fake, self-assigned with Distra)`;
// Without Nitro, Discord turns custom emoji in an About Me into plain :name: text whenever it's saved.
const CUSTOM_EMOJI = /<a?:\w+:\d+>/;

const codesOf = (badges: FakeBadge[]) => badges.map(badge => badge.code).join("");

function BadgeEditor() {
    const userId = UserStore.getCurrentUser().id;
    const [, loadError] = useAwaiter(() => fetchUserProfile(userId, undefined, false));
    const bio = useStateFromStores([UserProfileStore], () => {
        const profile = UserProfileStore.getUserProfile(userId);
        return profile && (profile.bio ?? "");
    });
    const [draft, setDraft] = useState<FakeBadge[] | null>(null);
    const [dragged, setDragged] = useState<FakeBadge | null>(null);
    const [saving, setSaving] = useState(false);

    if (bio == null) {
        return (
            <Paragraph color={loadError ? "text-feedback-critical" : "text-muted"}>
                {loadError ? "Couldn't load your profile. Reopen this page to try again." : "Loading your profile..."}
            </Paragraph>
        );
    }

    const saved = decodeBadges(bio);
    const selected = draft ?? saved;
    const newBio = encodeBadges(bio, selected);
    const badgeChars = newBio.length - stripBadges(bio).length;
    const maxLength = bioMaxLength();
    const tooLong = newBio.length > maxLength;
    const dirty = codesOf(selected) !== codesOf(saved);
    const losesEmoji = CUSTOM_EMOJI.test(bio) && !UserStore.getCurrentUser().premiumType;

    const toggle = (badge: FakeBadge) => setDraft(selected.includes(badge) ? selected.filter(b => b !== badge) : [...selected, badge]);

    const moveDragged = (target: FakeBadge) => {
        if (!dragged || dragged === target) return;
        const reordered = selected.filter(b => b !== dragged);
        reordered.splice(selected.indexOf(target), 0, dragged);
        setDraft(reordered);
    };

    function confirmSave() {
        if (!losesEmoji) return save();
        Alerts.show({
            title: "Your custom emoji will turn into text",
            body: "Your About Me has custom emoji, and without Nitro Discord turns them into plain :name: text whenever an About Me is saved, from any app. Save anyway?",
            confirmText: "Save anyway",
            cancelText: "Cancel",
            onConfirm: save
        });
    }

    async function save() {
        setSaving(true);
        try {
            const { body } = await RestAPI.patch({ url: Constants.Endpoints.USER_PROFILE("@me"), body: { bio: newBio } });
            FluxDispatcher.dispatch({ type: "USER_PROFILE_UPDATE_SUCCESS", userId, ...body });
            setDraft(null);
            showToast({
                text: selected.length ? `Saved ${pluralise(selected.length, "fake badge")} to your profile.` : "Removed your fake badges.",
                variant: "success"
            });
        } catch (e) {
            logger.error("Failed to save badges", e);
            showToast({ text: "Couldn't save your badges. Discord rejected the profile update.", variant: "critical" });
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className={cl("editor")}>
            <Paragraph>
                Pick badges for your profile. They're stored invisibly in your About Me, so anyone using Distra with
                this plugin sees them too, always labeled as fake.
            </Paragraph>

            <Heading tag="h4" className={Margins.top16}>Preview</Heading>
            <div className={cl("preview")}>
                {selected.length ? (
                    <div className={cl("row")} role="group" aria-label="Badge preview">
                        {selected.map(badge => (
                            <Tooltip key={badge.code} text={fakeName(badge)}>
                                {tooltipProps => (
                                    <div
                                        {...tooltipProps}
                                        className={cl("row-badge", { dragging: dragged === badge })}
                                        draggable
                                        onDragStart={() => setDragged(badge)}
                                        onDragEnter={() => moveDragged(badge)}
                                        onDragOver={e => e.preventDefault()}
                                        onDragEnd={() => setDragged(null)}
                                    >
                                        <img className={cl("badge")} src={badgeIconUrl(badge)} alt={fakeName(badge)} draggable={false} />
                                    </div>
                                )}
                            </Tooltip>
                        ))}
                    </div>
                ) : (
                    <BaseText size="sm" color="text-muted">No badges selected. Click badges below to add them.</BaseText>
                )}
            </div>
            {selected.length > 1 && (
                <BaseText size="xs" color="text-muted" className={Margins.top4}>Drag badges in the preview to reorder them.</BaseText>
            )}

            {BADGE_GROUPS.map(group => (
                <div key={group.name} className={Margins.top16}>
                    <Heading tag="h4" className={Margins.bottom8}>{group.name}</Heading>
                    <div className={cl("grid")}>
                        {group.badges.map(badge => {
                            const position = selected.indexOf(badge) + 1;
                            return (
                                <Clickable
                                    key={badge.code}
                                    className={cl("tile", { selected: position > 0 })}
                                    role="checkbox"
                                    aria-checked={position > 0}
                                    onClick={() => toggle(badge)}
                                >
                                    <img className={cl("tile-icon")} src={badgeIconUrl(badge)} alt="" />
                                    <BaseText size="sm" weight="medium" className={cl("tile-name")}>{badge.name}</BaseText>
                                    {position > 0 && <span className={cl("tile-position")}>{position}</span>}
                                </Clickable>
                            );
                        })}
                    </div>
                </div>
            ))}

            {losesEmoji && (
                <Notice.Warning className={Margins.top16}>
                    Your About Me has custom emoji. Without Nitro, Discord turns them into plain :name: text when an About Me is saved, so saving here will do that.
                </Notice.Warning>
            )}

            {tooLong && (
                <Notice.Warning className={Margins.top16}>
                    Your About Me doesn't have room for this many badges. Remove some badges or shorten your About Me.
                </Notice.Warning>
            )}

            <div className={cl("footer")}>
                <BaseText size="sm" color={tooLong ? "text-feedback-critical" : "text-muted"}>
                    About Me: {newBio.length} of {maxLength} characters used, {badgeChars} by badges.
                    {dirty && " Unsaved changes."}
                </BaseText>
                <div className={cl("actions")}>
                    {dirty && <Button variant="secondary" size="small" onClick={() => setDraft(null)}>Undo</Button>}
                    <Button size="small" disabled={!dirty || tooLong || saving} onClick={confirmSave}>
                        {saving ? "Saving..." : "Save to profile"}
                    </Button>
                </div>
            </div>
        </section>
    );
}

const settings = definePluginSettings({
    badges: {
        type: OptionType.COMPONENT,
        component: BadgeEditor
    }
});

const fakeBadges: ProfileBadge = {
    id: "distra_fake_badges",
    getBadges: ({ userId }) => decodeBadges(UserProfileStore.getUserProfile(userId)?.bio).map(badge => ({
        id: `distra_fake_badge_${badge.code}`,
        description: fakeName(badge),
        iconSrc: badgeIconUrl(badge)
    }))
};

export default definePlugin({
    name: "FakeBadges",
    description: "Give yourself any Discord badge. Other Distra users see them on your profile, clearly labeled as fake.",
    tags: ["Appearance", "Customisation"],
    authors: [EquicordDevs.mmeta],
    dependencies: ["BadgeAPI"],
    settings,
    userProfileBadges: [fakeBadges]
});
