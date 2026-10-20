# OMetaVR/Equicord fork

This is a fork of [Equicord/Equicord](https://github.com/Equicord/Equicord). Upstream `main` is merged in
automatically; the fork's own changes sit on top. Everything listed here must survive an upstream merge.

## Customizations

### Fork-only plugins (whole directories, upstream never touches them)

- `src/equicordplugins/favoriteMedia/` - save and organize GIFs, images and videos.
- `src/equicordplugins/followUser/`
- `src/equicordplugins/spotifyLyrics/`
- `src/equicordplugins/betterSpotifyCard/`
- `src/wardenplugins/nsfwInviteSpamDetector/` - Warden plugin.

### Warden plugin category

A fourth plugin directory, `src/wardenplugins/`, alongside `plugins`, `equicordplugins` and `userplugins`.

- `scripts/build/common.mjs`: `wardenplugins` in the `globPlugins` dir list and `wardenPlugin` in each `PluginMeta` entry.
- `scripts/build/build.mjs`: `wardenplugins` in the natives dir list.
- `src/modules.d.ts`: `wardenPlugin: boolean` on `PluginMeta`.
- `src/plugins/_core/supportHelper.tsx`: "Has WardenPlugins" debug line and an "Enabled Warden Plugins" list.
- `src/plugins/_api/badges/index.tsx`: `WardenPluginContributorBadge`.
- `src/components/settings/tabs/plugins/` (`index.tsx`, `PluginCard.tsx`, `PluginModal.tsx`, `PluginStatCards.tsx`):
  plugin stat cards and Warden plugin display in the plugins tab.

### Badges

- `badges.json` (repo root) and `browser/*.png|gif`: fork badge data and images.
- `src/plugins/_api/badges/index.tsx`: loads `https://raw.githubusercontent.com/OMetaVR/Equicord/main/badges.json`
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

When upstream restructures this file, keep upstream's structure (function names, the `Updater` export) and re-apply
these behaviors inside it.

### Small fixes

- `src/plugins/_core/noTrack.ts`: disables Sentry by returning instead of throwing.
- `src/plugins/_core/settings.tsx`: falls back to `"top"` when `settingsLocation` is not a string.
- `src/equicordplugins/musicControls/spotify/PlayerComponent.tsx`: one-line fork tweak.
- `misc/install.sh`: downloads the installer from `OMetaVR/Equilotl`.
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
