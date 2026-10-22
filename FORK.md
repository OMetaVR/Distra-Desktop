# Distra Desktop (OMetaVR/Distra-Desktop)

Distra Desktop is a fork of [Equicord/Equicord](https://github.com/Equicord/Equicord), shown to users as **Distra**.
Upstream `main` is merged in automatically; the fork's own changes sit on top. Everything listed here must survive an
upstream merge.

## Branding

The source keeps upstream's "Equicord" text so merges stay conflict free. `scripts/build/branding.mjs`, registered in
`commonOpts.plugins` in `scripts/build/common.mjs`, rewrites user-facing text to Distra at build time. It only touches
string literals, template literals and JSX text, never identifiers, imports, storage keys or URLs.

- Rules, exceptions and the display name constant (`CLIENT_NAME`) all live in `branding.mjs`.
- Kept as Equicord on purpose: Equicord's donor, contributor and translator programs, its team, support server and
  cloud backend, the "Equicord Plugin" marker on Equicord-made plugins, the supportHelper and EquicordHelper plugins,
  and data folder names.
- Never rename functional names: the `Equicord` data folder, `equicord.asar`, `EQUICORD_*` environment variables,
  storage keys, plugin names (they are settings keys), or the `// Equicord <hash>` build banner the installer reads.
- New upstream text is rebranded automatically. When upstream adds text that names Equicord's own programs, add a
  `KEEP` rule instead of editing the upstream file.
- Outside `src/`, edited directly: `README.md`, `browser/manifest*.json`, `browser/userscript.meta.js`,
  `scripts/runInstaller.mjs` and `misc/install.sh` (Distra Installer downloads).
- The installer is [OMetaVR/Distra-Installer](https://github.com/OMetaVR/Distra-Installer), a fork of Equilotl.

## Customizations

### Fork-only plugins (whole directories, upstream never touches them)

- `src/equicordplugins/favoriteMedia/` - save and organize GIFs, images and videos.
- `src/equicordplugins/followUser/`
- `src/equicordplugins/spotifyLyrics/`
- `src/equicordplugins/betterSpotifyCard/`
- `src/distraplugins/nsfwInviteSpamDetector/` - Distra plugin. It syncs with the Warden bot, so its `/internal/warden`
  endpoint, `x-warden-secret` header and `VencordWardenInviteSpamDetector` database name must keep their names.
- `src/distraplugins/expandableBadges/` - Distra plugin: undoes Discord's six badge profile cutoff or makes it expandable.
- `src/distraplugins/fakeBadges/` - Distra plugin: self-assigned Discord badges, stored as invisible tag characters
  (`{DB:<codes>}`) in the user's bio and shown to other Distra users with a "fake" tooltip. Badge codes in `badges.ts`
  are stored in bios, so never change or reuse one.
- `src/distraplugins/iconPacks/` - Distra plugin: Distra for iOS's icon packs (Plumpy, Iconsax) on desktop. Downloads each
  pack's redesign icons (rosiecord plus the additions in OMetaVR/Distra `iconpacks/`) into DataStore. A patch on every icon
  component (`size:"md"` destructure) swaps the artwork for a mask of the pack's icon; another hands it Discord's named icon
  registry. Pack ids and `additionsVersion` must match iOS's `src/lib/iconpackDownloads.ts`.
  Desktop-only art lives in `iconPacks/desktop/<pack>/` (SVGs plus aliases to pack icons or files, some mirrored) and is
  never part of the iOS download; bump that pack's desktop `version` when it changes. Discord's Lottie icons (mute,
  deafen, settings, gift, GIF, sticker, apps) are swapped at the Lottie player's return, matched by markers or by the
  webpack module of their animation data. Plugin icons are matched by button aria-label in `PLUGIN_ICONS` and drawn with
  CSS masks. The plugin starts at `Init` so the pack is loaded before Discord's first render.
- `src/distraplugins/customFonts/` - Distra plugin: Distra for iOS's Font Loader on desktop (Google Fonts or .ttf/.otf links,
  separate text and code fonts, headings, messages-only scope, size, weight, line spacing, matching gg sans). Registers
  FontFace objects under Discord's own family names. Its settings use iOS's `FontLoaderSettings` shape for future sync.

### Distra plugin category

A fourth plugin directory, `src/distraplugins/`, alongside `plugins`, `equicordplugins` and `userplugins`.

- `scripts/build/common.mjs`: `distraplugins` in the `globPlugins` dir list and `distraPlugin` in each `PluginMeta` entry.
- `scripts/build/build.mjs`: `distraplugins` in the natives dir list.
- `scripts/generatePluginList.ts`: `src/distraplugins` in the default dir list.
- `src/modules.d.ts`: `distraPlugin: boolean` on `PluginMeta`.
- `src/plugins/_core/supportHelper.tsx`: "Has DistraPlugins" debug line and an "Enabled Distra Plugins" list.
- `src/plugins/_api/badges/index.tsx`: `DistraPluginContributorBadge`.
- `src/components/settings/tabs/plugins/` (`index.tsx`, `PluginCard.tsx`, `PluginModal.tsx`, `PluginStatCards.tsx`):
  plugin stat cards and Distra plugin display in the plugins tab.

### Badges

- `badges.json` (repo root) and `browser/*.png|gif`: fork badge data and images.
- `src/plugins/_api/badges/index.tsx`: loads `https://raw.githubusercontent.com/OMetaVR/Distra-Desktop/main/badges.json`
  as `CustomBadges` and exposes `getCustomBadges`.
- `src/api/Badges.ts`: adds `getCustomBadges` badges and gives every badge a stable `id`.

### Updater (`src/main/updater/http.ts`)

The in-client updater follows this fork's GitHub releases (`build-<commit>` tags made by `.github/workflows/build.yml`).
The fork version, compared with upstream:

- Resolves the release's tag ref to a commit (`/git/refs/tags/<tag>`) instead of parsing the release name.
- Only offers an update if `/compare/<installed>...<release>` is `ahead` (never downgrades) and the release has the asar asset.
- Lists changes between the installed commit and the release commit, not `HEAD`.
- `getAsarPath()` finds the asar whether running from inside the asar or a directory, and `applyUpdate` writes to
  `<asar>.tmp` then renames it into place.
- Requests go through Electron's `net.fetch` (system certificates and proxies; Node's fetch broke on Windows antivirus
  HTTPS scanning), GitHub rate limits get a readable error, and the updater UI shows the error's `message`.

When upstream restructures this file, keep upstream's structure (function names, the `Updater` export) and re-apply
these behaviors inside it.

### Small fixes

- `src/plugins/_core/noTrack.ts`: disables Sentry by returning instead of throwing.
- `src/components/settings/tabs/vencord/index.tsx`: "Distra is based on Equicord and Vencord." credit line.
- `src/equicordplugins/discordDevBanner/components/makeDevBanner.tsx`: fills in `{equicordName}`, which upstream
  never replaces.
- `src/plugins/_core/settings.tsx`: falls back to `"top"` when `settingsLocation` is not a string.
- `src/equicordplugins/pingNotifications/index.tsx`: uses `UserGuildSettingsStore.isChannelMuted`, since Discord removed
  `channel.isMuted()`.
- `src/equicordplugins/musicControls/spotify/PlayerComponent.tsx`: one-line fork tweak.
- `misc/install.sh`, `scripts/runInstaller.mjs`: download the installer from `OMetaVR/Distra-Installer`.
- `others/Equilotl`: installer submodule.
- `pnpm-workspace.yaml`: `enableGlobalVirtualStore: false`.
- `vitest.config.ts`: fork test config.

### Automation (fork only)

- `.github/workflows/syncupstream.yml` and `.fork/sync.sh`: upstream sync, described below.
- `.github/workflows/build.yml`: publishes `build-<commit>` releases on every push to `main`.
- `.fork/fixer/`: the local Claude Code fixer.

## Upstream sync

1. `syncupstream.yml` runs every three hours (or on demand: `gh workflow run syncupstream.yml`).
2. `.fork/sync.sh` merges `upstream/main` into `main`, starting from `sync/upstream` if that branch exists (an earlier
   or hand/AI-fixed merge).
3. The merge is validated: `pnpm testTsc`, `lint`, `lint-styles`, `buildStandalone`, `buildWebStandalone`,
   `generatePluginJson`.
4. Passed: `main` is fast-forwarded, `sync/upstream` is deleted, open sync issues are closed and a release is published.
   Discord's in-client updater then offers it.
5. Merge conflict or failed validation: `main` is left alone and an issue labeled `upstream-sync` and `needs-ai-fix` is
   opened (failed builds are also pushed to `sync/upstream`).
6. The local fixer (`.fork/fixer/`, a systemd user timer on the desktop) picks up the issue within five minutes, runs
   Claude Code to fix it on `sync/upstream`, validates locally, pushes, and re-runs the sync. After three failed attempts
   for one upstream commit it labels the issue `needs-human` and sends a critical desktop notification.

Fixing by hand instead:

```sh
git fetch origin && git fetch upstream
git checkout -B sync/upstream origin/main
git merge upstream/main     # resolve, keeping everything listed above
pnpm install --frozen-lockfile && pnpm testTsc && pnpm lint && pnpm buildStandalone
git push -f origin sync/upstream
gh workflow run syncupstream.yml
```
