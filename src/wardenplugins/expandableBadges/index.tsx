/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { ChevronSmallLeftIcon, ChevronSmallRightIcon } from "@components/Icons";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { pluralise } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { Tooltip, useState } from "@webpack/common";

const cl = classNameFactory("vc-expandable-badges-");

const settings = definePluginSettings({
    alwaysExpand: {
        type: OptionType.BOOLEAN,
        description: "Always show every badge, without the expand button.",
        default: false
    },
    collapsedCount: {
        type: OptionType.SLIDER,
        description: "How many badges show while collapsed. Discord shows 6.",
        markers: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        stickToMarkers: true,
        default: 6
    },
    rememberExpanded: {
        type: OptionType.BOOLEAN,
        description: "Keep badges expanded on every profile once you expand them, until you collapse them again.",
        default: true
    }
}).withPrivateSettings<{ expanded?: boolean; }>();

const STATE_KEYS: ("expanded" | "rememberExpanded")[] = ["expanded", "rememberExpanded"];

type ExpandedState = [expanded: boolean, setExpanded: (expanded: boolean) => void];

interface ToggleProps {
    expanded: boolean;
    hidden: number;
    setExpanded(expanded: boolean): void;
}

function BadgeToggle({ expanded, hidden, setExpanded }: ToggleProps) {
    const label = expanded ? "Show fewer badges" : `Show ${pluralise(hidden, "more badge")}`;
    const Chevron = expanded ? ChevronSmallLeftIcon : ChevronSmallRightIcon;

    return (
        <Tooltip text={label}>
            {tooltipProps => (
                <button
                    {...tooltipProps}
                    type="button"
                    className={cl("toggle")}
                    aria-label={label}
                    aria-expanded={expanded}
                    onClick={e => {
                        e.stopPropagation();
                        setExpanded(!expanded);
                    }}
                >
                    {!expanded && <span className={cl("count")}>+{hidden}</span>}
                    <Chevron width={16} height={16} />
                </button>
            )}
        </Tooltip>
    );
}

const Toggle = ErrorBoundary.wrap(BadgeToggle, { noop: true });

export default definePlugin({
    name: "ExpandableBadges",
    description: "Shows every profile badge again, or lets you expand Discord's collapsed badge list in place.",
    authors: [EquicordDevs.mmeta],
    settings,

    patches: [
        {
            find: '"UserProfileBadgeListRows"',
            group: true,
            replacement: [
                {
                    // Expanded state, declared before the component's early return so hook order never changes.
                    match: /(?<=\(\{location:"UserProfileBadgeListRows"\}\))/,
                    replace: ",vcBadgeState=$self.useExpandedState()"
                },
                {
                    // Replace Discord's fixed six badge cutoff and its "+N" pill with our layout.
                    match: /let (\i)=(\i&&!\i),(\i)=\1\?Math\.max\((\i)\.length-\i\.\i,0\):0;return (\i)=\1\?\[\4\.slice\(0,\i\.\i\)\]/,
                    replace: "let $1=$2,$3=0,vcLayout=$self.getLayout($1,$4,vcBadgeState);return $5=$1?vcLayout.rows"
                },
                {
                    match: /(?<=overflowCount:\i,displayProfile:\i,)(?=onClose:)/,
                    replace: "vcToggle:vcLayout.toggle,"
                },
                {
                    // Render the toggle where Discord renders its "+N" pill.
                    match: /(?=\i>0&&\(\i\?.{0,250}?openBadgeDirectoryModal\)\(\{targetUserId:)/,
                    replace: "$self.renderToggle(arguments[0].vcToggle),"
                }
            ]
        }
    ],

    useExpandedState(): ExpandedState {
        const { expanded = false, rememberExpanded } = settings.use(STATE_KEYS);
        const [localExpanded, setLocalExpanded] = useState(false);

        return rememberExpanded
            ? [expanded, value => settings.store.expanded = value]
            : [localExpanded, setLocalExpanded];
    },

    getLayout(consolidated: boolean, badges: unknown[], [expanded, setExpanded]: ExpandedState) {
        if (!consolidated) return { rows: [], toggle: null };

        const { alwaysExpand, collapsedCount } = settings.store;
        const hidden = badges.length - collapsedCount;

        // A "+1" button takes as much room as the badge it hides.
        if (alwaysExpand || hidden <= 1) return { rows: [badges], toggle: null };

        return {
            rows: [expanded ? badges : badges.slice(0, collapsedCount)],
            toggle: { expanded, hidden, setExpanded }
        };
    },

    renderToggle(toggle: ToggleProps | null) {
        return toggle && <Toggle {...toggle} />;
    }
});
