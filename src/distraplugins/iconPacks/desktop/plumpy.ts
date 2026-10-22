/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AngleBracketsIcon from "file://plumpy/AngleBracketsIcon.svg";
import BoostGemSlashIcon from "file://plumpy/BoostGemSlashIcon.svg";
import BoostTier3Icon from "file://plumpy/BoostTier3Icon.svg";
import CalendarPlusIcon from "file://plumpy/CalendarPlusIcon.svg";
import ChatArrowRightIcon from "file://plumpy/ChatArrowRightIcon.svg";
import ChatShieldIcon from "file://plumpy/ChatShieldIcon.svg";
import ChatSpeakIcon from "file://plumpy/ChatSpeakIcon.svg";
import CreditCardIcon from "file://plumpy/CreditCardIcon.svg";
import DenyIcon from "file://plumpy/DenyIcon.svg";
import DiceIcon from "file://plumpy/DiceIcon.svg";
import DoubleCheckmarkIcon from "file://plumpy/DoubleCheckmarkIcon.svg";
import DoubleChevronSmallRightIcon from "file://plumpy/DoubleChevronSmallRightIcon.svg";
import FireIcon from "file://plumpy/FireIcon.svg";
import FolderIcon from "file://plumpy/FolderIcon.svg";
import InboxIcon from "file://plumpy/InboxIcon.svg";
import PaperPlusIcon from "file://plumpy/PaperPlusIcon.svg";
import PaymentTypeGiftCardIcon from "file://plumpy/PaymentTypeGiftCardIcon.svg";
import RibbonIcon from "file://plumpy/RibbonIcon.svg";
import ScreenArrowIcon from "file://plumpy/ScreenArrowIcon.svg";
import SubscriptionIcon from "file://plumpy/SubscriptionIcon.svg";
import TextSpoilerIcon from "file://plumpy/TextSpoilerIcon.svg";
import ThumbsDownIcon from "file://plumpy/ThumbsDownIcon.svg";
import ThumbsUpIcon from "file://plumpy/ThumbsUpIcon.svg";
import UserCheckIcon from "file://plumpy/UserCheckIcon.svg";
import UserPlatformIcon from "file://plumpy/UserPlatformIcon.svg";

import type { DesktopAdditions } from "../packs";

// Desktop only: never part of the iOS pack download.
export const PLUMPY_DESKTOP: DesktopAdditions = {
    version: 1,
    aliases: {
        AppsIcon: { icon: "GridSquareIcon" },
        ArrowAngleRightUpIcon: { icon: "ArrowAngleLeftUpIcon", mirror: true },
        ArrowLargeLeftIcon: { file: "modules/main_tabs_v2/native/images/stack-nav-back@3x.png" },
        ArrowLargeRightIcon: { file: "modules/main_tabs_v2/native/images/stack-nav-back@3x.png", mirror: true },
        ArrowSmallLeftIcon: { file: "modules/main_tabs_v2/native/images/stack-nav-back@3x.png" },
        ArrowSmallRightIcon: { file: "modules/main_tabs_v2/native/images/stack-nav-back@3x.png", mirror: true },
        BeakerIcon: { icon: "ScienceDefaultIcon" },
        BookmarkOutlineIcon: { icon: "BookmarkIcon" },
        BoostGemOutlineIcon: { icon: "BoostGemIcon" },
        ChatMarkUnreadIcon: { icon: "MarkUnreadIcon" },
        CheckmarkSmallBoldIcon: { icon: "CheckmarkSmallIcon" },
        ChevronLargeDownIcon: { icon: "ChevronSmallDownIcon" },
        ChevronLargeUpIcon: { icon: "ChevronSmallUpIcon" },
        CompassIcon: { file: "images/native/icons/discovery_20px@2x.png" },
        CrownIcon: { file: "images/native/icons/ic_crown_16px@3x.png" },
        EnvelopeIcon: { file: "images/native/icons/ic_mail@3x.png" },
        EyeSlashIcon: { file: "images/native/icons/ic_hide_24px@3x.png" },
        FileUpIcon: { file: "images/native/icons/ic_upload@3x.png" },
        FiltersHorizontalIcon: { file: "images/native/ic_filter@3x.png" },
        GifIcon: { file: "modules/main_tabs_v2/native/images/icon-qs-gifs@3x.png" },
        GroupPlusIcon: { file: "images/native/icons/ic_add_friend@3x.png" },
        HeartOutlineIcon: { file: "modules/emoji_picker/native/images/heart@3x.png" },
        ImagePlusIcon: { file: "modules/guild_role_subscriptions/native/images/ic_upload_24px@3x.png" },
        ImagesIcon: { file: "modules/forums/native/images/ic_upload@3x.png" },
        LinkExternalSmallIcon: { file: "images/native/icons/ic_open_in_browser@3x.png" },
        MaximizeIcon: { file: "modules/voice_panel/native/images/maximize@3x.png" },
        MoreVerticalIcon: { file: "images/native/icons/ic_more_android@3x.png" },
        PauseIcon: { file: "images/native/media/pause@3x.png" },
        PinIcon: { file: "images/native/chat_sidebar/ic_pins@3x.png" },
        PlayIcon: { file: "images/native/media/play@3x.png" },
        PlusMediumIcon: { icon: "PlusLargeIcon" },
        PollsIcon: { file: "modules/chat_input/native/images/ic_poll@3x.png" },
        ReactionIcon: { icon: "SmilePlusIcon" },
        RefreshIcon: { file: "images/native/ic_message_retry@3x.png" },
        SignPostIcon: { file: "images/native/icons/ic_sign_post@3x.png" },
        StarOutlineIcon: { icon: "StarIcon" },
        StickerSmallIcon: { icon: "StickerIcon" },
        SuperReactionIcon: { icon: "AddSuperReactionIcon" },
        TextIcon: { icon: "ChannelsTextIcon" },
        TextLockIcon: { icon: "ChannelsTextLockedIcon" },
        TextWarningIcon: { icon: "ChannelsTextWarningIcon" },
        TimerIcon: { file: "images/native/icons/ic_timer_24px@3x.png" },
        TvIcon: { file: "images/native/icons/ic_monitor@3x.png" },
        UnknownGameIcon: { file: "images/native/game_icon_placeholder@3x.png" },
        UserCircleStatusIcon: { file: "modules/stage_channels/native/images/ic_person_status@3x.png" },
        VoiceLockIcon: { icon: "ChannelsVoiceLockedIcon" },
        VoiceNormalIcon: { icon: "ChannelsVoiceNormalIcon" },
        VoiceWarningIcon: { icon: "ChannelsVoiceWarningIcon" },
        WindowLaunchIcon: { file: "images/native/ic_launch@3x.png" },
        XLargeIcon: { icon: "CloseLargeIcon" },
        XSmallBoldIcon: { icon: "CloseSmallIcon" },
        XSmallIcon: { icon: "CloseSmallIcon" }
    },
    icons: {
        AngleBracketsIcon,
        BoostGemSlashIcon,
        BoostTier3Icon,
        CalendarPlusIcon,
        ChatArrowRightIcon,
        ChatShieldIcon,
        ChatSpeakIcon,
        CreditCardIcon,
        DenyIcon,
        DiceIcon,
        DoubleCheckmarkIcon,
        DoubleChevronSmallRightIcon,
        FireIcon,
        FolderIcon,
        InboxIcon,
        PaperPlusIcon,
        PaymentTypeGiftCardIcon,
        RibbonIcon,
        ScreenArrowIcon,
        SubscriptionIcon,
        TextSpoilerIcon,
        ThumbsDownIcon,
        ThumbsUpIcon,
        UserCheckIcon,
        UserPlatformIcon
    }
};
