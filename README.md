# [<img src="./browser/icon.png" width="40" align="left" alt="Distra">](https://github.com/OMetaVR/Distra-Desktop) Distra Desktop

[![Tests](https://github.com/OMetaVR/Distra-Desktop/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/OMetaVR/Distra-Desktop/actions/workflows/test.yml)

Distra is a Discord desktop client mod. It's built on [Equicord](https://github.com/Equicord/Equicord), which is a fork of
[Vencord](https://github.com/Vendicated/Vencord), and keeps in sync with Equicord automatically while adding its own plugins.
The iOS client lives at [OMetaVR/Distra](https://github.com/OMetaVR/Distra).

This is a personal project and not affiliated with Equicord or Vencord. Please don't take Distra issues to their Discord
servers or issue trackers.

### Included Plugins

Distra ships Equicord's plugins, which are listed [here](https://equicord.org/plugins), plus its own, listed at the end of
this readme.

If you want to submit one of the Distra plugins to Equicord or Vencord, or refactor its code, you have my permission as
long as you add me to the authors and give credit.

## Installing / Uninstalling

Use the [Distra Installer](https://github.com/OMetaVR/Distra-Installer). Builds are unsigned, so Windows SmartScreen and
macOS Gatekeeper will ask you to allow them the first time.

Windows

| | X64 |
| --- | --- |
| GUI | [Download](https://github.com/OMetaVR/Distra-Installer/releases/latest/download/DistraInstaller.exe) |
| CLI | [Download](https://github.com/OMetaVR/Distra-Installer/releases/latest/download/DistraInstallerCli.exe) |

MacOS

| | X64 | ARM64 |
| --- | --- | --- |
| GUI | [Download](https://github.com/OMetaVR/Distra-Installer/releases/latest/download/DistraInstaller-x64.dmg) | [Download](https://github.com/OMetaVR/Distra-Installer/releases/latest/download/DistraInstaller-arm64.dmg) |
| CLI | [Download](https://github.com/OMetaVR/Distra-Installer/releases/latest/download/DistraInstallerCli-darwin-amd64) | [Download](https://github.com/OMetaVR/Distra-Installer/releases/latest/download/DistraInstallerCli-darwin-arm64) |

The CLI builds are plain binaries, so run `chmod +x <file>` after downloading.

Linux

| | X64 | ARM64 |
| --- | --- | --- |
| Combined GUI | [Download](https://github.com/OMetaVR/Distra-Installer/releases/latest/download/DistraInstaller) | [Download](https://github.com/OMetaVR/Distra-Installer/releases/latest/download/DistraInstaller-arm64) |
| X11 GUI | [Download](https://github.com/OMetaVR/Distra-Installer/releases/latest/download/DistraInstaller-x11) | [Download](https://github.com/OMetaVR/Distra-Installer/releases/latest/download/DistraInstaller-x11-arm64) |
| Wayland GUI | [Download](https://github.com/OMetaVR/Distra-Installer/releases/latest/download/DistraInstaller-wayland) | [Download](https://github.com/OMetaVR/Distra-Installer/releases/latest/download/DistraInstaller-wayland-arm64) |
| CLI | [Download](https://github.com/OMetaVR/Distra-Installer/releases/latest/download/DistraInstallerCli-linux) | [Download](https://github.com/OMetaVR/Distra-Installer/releases/latest/download/DistraInstallerCli-linux-arm64) |

```shell
sh -c "$(curl -sS https://raw.githubusercontent.com/OMetaVR/Distra-Installer/main/install.sh)"
```

## Installing a Distra dev build

### Dependencies

[Git](https://git-scm.com/download) and [Node.JS LTS](https://nodejs.dev/en/) are required.

Install `pnpm`:

> :exclamation: This next command may need to be run as admin/root depending on your system, and you may need to close and reopen your terminal for pnpm to be in your PATH.

```shell
npm i -g pnpm
```

> :exclamation: **IMPORTANT** Make sure you aren't using an admin/root terminal from here onwards. It **will** mess up your Discord/Distra instance and you **will** most likely have to reinstall.

Clone Distra:

```shell
git clone https://github.com/OMetaVR/Distra-Desktop
cd Distra-Desktop
```

Install dependencies:

```shell
pnpm install --frozen-lockfile
```

Build Distra:

```shell
pnpm build
```

Inject Distra into your desktop client:

```shell
pnpm inject
```

Build Distra for web:

```shell
pnpm buildWeb
```

After building Distra's web extension, locate the appropriate ZIP file in the `dist` directory and follow your browser’s guide for installing custom extensions, if supported.

Note: Firefox extension zip requires Firefox for developers

## Credits

Thank you to [Vendicated](https://github.com/Vendicated) for creating [Vencord](https://github.com/Vendicated/Vencord) & [Suncord](https://github.com/verticalsync/Suncord) by [verticalsync](https://github.com/verticalsync) for helping when needed.

And thank you Equicord for the amazing work you've done on your own fork!

## Star History of Official Equicord (look at how cool they are!)

<a href="https://star-history.com/#Equicord/Equicord&Timeline">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Equicord/Equicord&type=Timeline&theme=dark&sealed_token=64drv2U7WiV6dQ5VRbOZdxHT3mRzxUzhVvfm5qt1VRpGjVPje0PbObjibX2FYe4zd-h36lCAGZ873gAgb_5_tAzUBixUVbtaLHqy1fNH6PkQP_PqPdKztatlI2s17T9IUFzRyhYynmJ1-H4idFFzEAMN1gRZlVvvmJ71P0LovJPOIqTT7uHIubWcHzxC" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Equicord/Equicord&type=Timeline&sealed_token=64drv2U7WiV6dQ5VRbOZdxHT3mRzxUzhVvfm5qt1VRpGjVPje0PbObjibX2FYe4zd-h36lCAGZ873gAgb_5_tAzUBixUVbtaLHqy1fNH6PkQP_PqPdKztatlI2s17T9IUFzRyhYynmJ1-H4idFFzEAMN1gRZlVvvmJ71P0LovJPOIqTT7uHIubWcHzxC" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Equicord/Equicord&type=Timeline&sealed_token=64drv2U7WiV6dQ5VRbOZdxHT3mRzxUzhVvfm5qt1VRpGjVPje0PbObjibX2FYe4zd-h36lCAGZ873gAgb_5_tAzUBixUVbtaLHqy1fNH6PkQP_PqPdKztatlI2s17T9IUFzRyhYynmJ1-H4idFFzEAMN1gRZlVvvmJ71P0LovJPOIqTT7uHIubWcHzxC" />
  </picture>
</a>

## Disclaimer

Discord is trademark of Discord Inc., and solely mentioned for the sake of descriptivity.
Mentioning it does not imply any affiliation with or endorsement by Discord Inc.
Vencord is not connected to Equicord and as such, all donation links go to Vendicated's donation link.

<details>
<summary>Using Distra, like any client mod, violates Discord's terms of service</summary>

Client modifications are against Discord’s Terms of Service.

However, Discord is pretty indifferent about them and there are no known cases of users getting banned for using client mods without malicious intent! So you should generally be fine if you don’t use plugins that implement abusive behaviour. But no worries, all inbuilt plugins are safe to use!

Regardless, if your account is essential to you and getting disabled would be a disaster for you, you should probably not use any client mods (not exclusive to Distra), just to be safe.

Additionally, make sure not to post screenshots with Distra (and any other clients) in a server where you might get banned for it.

</details>

## List of plugins added by this fork

<details>
<summary>Custom Plugins</summary>

| Name | Description | Original Repo |
|------|-------------|---------------|
| betterSpotifyCard | Enhanced Spotify card display | [git.nin0.dev](https://git.nin0.dev/userplugins/betterSpotifyCard) |
| spotifyLyrics | Add's lyrics display to the spotify controls above the user control panel | [github.com](https://github.com/Masterjoona/vc-spotifylyrics/)
| favoriteMedia | BetterDiscord fork for favoriting any type of media with categories within the expression picker | I created this, it has no repo |
| expandableBadges | Shows every profile badge again, or lets you expand Discord's collapsed badge list in place | I created this, it has no repo |

</details>
