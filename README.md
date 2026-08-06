# CloverArcade

Self-hosted, arcade-style web front-end for open-source emulators. One Docker
image, one `/roms` volume, browser-based play on any device on your network --
part of the CloverStack.

Built on the shoulders of open-source giants: **EmulatorJS** (GPL-3.0, WASM
wrapper around libretro cores), **libretro / RetroArch** (GPL-3.0), and
**MAME** (GPL-2.0), and **KasmVNC** + **LinuxServer.io**'s KasmVNC baseimage for
the streamed cabinet. Thank you to those teams -- this is a wrapper around their
work, not a replacement for it.

---

## 1. Landscape -- what's out there (Aug 2026)

| Project | License | What it is | Fit for a web arcade image |
|---|---|---|---|
| **EmulatorJS** | GPL-3.0 | libretro cores compiled to WASM, runs in the browser, no plugins | **Chosen.** Only mature option that plays 25+ systems client-side with zero install |
| libretro / RetroArch | GPL-3.0 | The core ecosystem itself (nestopia, snes9x, mupen64plus, mame2003+, beetle-psx...) | Upstream of EmulatorJS; native builds need a desktop/X session |
| MAME | GPL-2.0 | The arcade preservation reference; huge romset compatibility | Best arcade accuracy, but native binary -- needs KasmVNC/Selkies streaming |
| FinalBurn Neo | non-commercial | Fast CPS1/2/3 + Neo Geo | Available as an EmulatorJS core (`arcade`/`fbneo`) |
| RomM | AGPL-3.0 | Library manager: metadata + box-art scraping, has its own EmulatorJS player | Great companion for cover art -- optional service in the compose file |
| Gamevault | MIT | Self-hosted library for **PC** games (not emulation) | Different job; pair it later if you want PC titles |
| EmuDeck / Batocera / RetroPie | GPL | Full OS/console images | Not containerizable for browser play |
| linuxserver/emulatorjs | GPL | Docker image around EmulatorJS + its own admin UI | Solid reference; its UI is functional, not branded -- we ship our own |

**Decision:** EmulatorJS core + a custom CloverStack front-end, packaged on
`nginx:alpine` with a shell ROM scanner. No database, no Node runtime, ~180 MB
image, works offline after first load.

## 2. What's in the box

```
Dockerfile              multi-stage: fetch pinned EmulatorJS release -> nginx:alpine
docker/entrypoint.sh    scans /roms at boot (optional rescan loop) -> /games.json
docker/nginx.conf       COOP/COEP headers (needed for threaded cores), range requests
ui/index.html           arcade marquee, system chips, cabinet grid, in-page player
ui/assets/arcade.css    black + metallic clover palette, CRT scanlines, hover cabinets
ui/assets/arcade.js     manifest loader, search/filter, EmulatorJS boot
docker-compose.yml      port 8088, ./roms + ./saves volumes, healthcheck, mame profile, optional RomM
mame/Dockerfile         native MAME on LinuxServer's KasmVNC baseimage
mame/root/...           autostart + clover-mame launcher (writes mame.ini on first run)
```

## 3. Run it

Pick one. All three need zero host-side setup -- no folders to create, no
permissions to fix, no LAN IP to look up. The container builds its own ROM
folder skeleton on first boot, and the `MAME CABINET` button resolves itself
against whatever hostname your browser used.

**a) Portainer (or any Docker host), straight from this repo**

*Stacks -> Add stack -> Repository*

| Field | Value |
|---|---|
| Repository URL | `https://github.com/jonfulk805-og/MyClover.Tech.CloverArcade` |
| Reference | `refs/heads/main` |
| Compose path | `docker-compose.portainer.yml` |

Deploy. ROMs and saves live in Docker named volumes the stack creates itself.

**b) Pull published images -- no build, no source**

```bash
docker compose -f docker-compose.ghcr.yml up -d
```

Or paste that file into Portainer's *Web editor* and deploy. The images are
built and published by GitHub Actions on every version tag -- the workflow ships
as `deploy/github-workflow-publish.yml`, move it to
`.github/workflows/publish.yml` once to activate it; make the packages public once after the
first run and it is a plain `docker pull` forever after.

**c) Local clone, with bind mounts for poking at files directly**

```bash
cd cloverarcade
docker compose up -d --build                    # arcade only
docker compose --profile mame up -d --build     # + native MAME cabinet
```

Then: arcade on **:8088**, MAME cabinet on **:8089** (https on 8443 -- needed for
the gamepad API).

**Getting games in.** Either set `UPLOAD_TOKEN` and use the **ADD ROMS** button
in the UI (section 4), or write into the volume directly -- Portainer's volume
browser, an SMB/SFTP share, or `docker cp`. Only add games you legally own.

**ROM layout -- the folder name selects the emulator core:**

```
roms/
  nes/        Super Clover Bros.nes
  snes/       Emerald Quest.sfc
  genesis/    clover_blast.md          (.md = Mega Drive, handled correctly)
  gba/        Pocket Clover.gba
  n64/        Shamrock Racer.z64
  psx/        game.chd | .cue + .bin
  arcade/     cloverfight.zip          (MAME 2003-plus / FBNeo romsets)
  nes/boxart/ Super Clover Bros.png    <- optional cover art, matched by filename
```

Supported folder names map to cores in `docker/entrypoint.sh`
(`core_for_system`): nes, snes, n64, gb, gbc, gba, nds, vb, genesis/megadrive,
sms, gg, saturn, psx, psp, atari2600/5200/7800, lynx, jaguar, pce, ngp, ws,
coleco, c64, amiga, dos, 3do, arcade/mame/neogeo/cps1-3. Add your own by
editing that one `case` block.

Env vars: `ARCADE_NAME`, `ARCADE_TAGLINE`, `ARCADE_THREADS`,
`ROM_RESCAN_SECONDS` (0 = scan at boot only), `MAME_CABINET_URL`
(`auto` = same host on :8089, `":9000"` = same host on a custom port, or a full
URL to override).

## 4. Uploading ROMs from the browser

Uploads are **off until you set a token** -- an arcade with no token has no write
endpoint at all. In `docker-compose.yml`:

```yaml
UPLOAD_TOKEN: "paste-a-long-random-string-here"
```

Then **ADD ROMS** appears in the header. Paste the token once (kept in your
browser), pick the system, drag files in. Notes:

- streamed straight to disk with a real progress bar -- a 4 GB PS1 image is fine
- `.zip` is fine, EmulatorJS reads it; no need to extract
- `UPLOAD_MAX_BYTES` caps per-file size (default 8 GiB)
- filenames are sanitised and executables (`.exe`, `.sh`, `.js`, ...) are refused
- new games appear within ~2 seconds -- no restart, no rescan wait
- `roms/bios/` is scanned for nothing; put BIOS files there and they stay out of
  the game grid

### Auto-fetch box art

Hit **AUTO-FETCH BOX ART** and CloverArcade matches every cover-less game in the
selected system against the [libretro thumbnail archive](https://thumbnails.libretro.com/)
and downloads the art into `roms/<system>/boxart/`. Matching normalises names and
prefers clean USA/World retail scans over hacks, betas and samples. Anything it
can't match is listed so you can drop a cover in by hand. Thank you to the
libretro community for maintaining that archive.

## 5. Two engines, one arcade

| | Browser engine (EmulatorJS) | MAME cabinet sidecar |
|---|---|---|
| How it runs | libretro cores as WASM, client-side | Real `mame` binary, streamed over KasmVNC |
| Systems | 25+ consoles + mame2003-plus / FBNeo arcade | Full modern MAME romset support, incl. 3D hardware |
| Latency | native-local (runs in your browser) | depends on your LAN; fine wired/Wi-Fi 5+ |
| Install size | ~180 MB | ~2 GB (Debian desktop session + MAME) |
| Default | always on | opt-in via `--profile mame` |

MAME state (cfg, nvram, save states, high scores) persists in `./saves/mame`.
Set `MAME_GAME=mslug` to boot straight into a romset, otherwise you land in
MAME's own game-selector UI. `MAME_EXTRA_ARGS` passes flags straight through.

## 6. Notes and limits

- **BIOS files**: PSX, Saturn, PSP, NDS and some others need BIOS. Drop the file
  next to the ROM and EmulatorJS will pick it up, or set `EJS_biosUrl` per-system.
- **Cross-origin isolation**: served headers enable SharedArrayBuffer for
  multi-threaded cores. Behind a reverse proxy, keep COOP/COEP intact and serve
  over HTTPS for gamepad + fullscreen APIs.
- **Save states** live in browser storage (IndexedDB) by default; `/saves` is
  mounted for a future server-side sync service.
- **Big discs** (PSP/Saturn/PSX ISO) load over HTTP range requests -- use CHD to
  keep them small.
- **Legal**: ships **no ROMs and no BIOS**. Only ROMs you legally own, or
  homebrew/public-domain sets. If CloverArcade ever becomes a paid CloverStack
  product, GPL-3.0 obligations from EmulatorJS apply -- ship source/attribution.

## 7. Verification status

- ROM scanner + manifest generation: **tested locally** with a fake multi-system
  ROM tree; correct core mapping, JSON, and `mame_url` passthrough.
- Upload API: **12 cases tested** including happy path, box art, blocked
  extensions, unknown system, path traversal, oversize, wrong token, delete,
  delete traversal, and the disabled-by-default state. Upload -> rescan ->
  manifest was verified end to end.
- Box-art fetcher: **tested live** against the real libretro archive (SNES + NES);
  correct covers downloaded, unmatched titles reported.
- Front-end: **rendered and visually checked** with a 10-game mock manifest.
- Shell scripts: syntax-checked (`bash -n`).
- `docker build` and live emulation: **not executed here** (no Docker daemon in
  the build sandbox) -- run `docker compose up -d --build` on your box. Same for
  the MAME sidecar: Debian's `mame` package version is whatever bookworm ships,
  so check `mame -help | head -1` after first boot and match your romset.

## 8. Next moves (optional)

1. Per-game deep links into the MAME cabinet (small launch API in the sidecar).
2. Server-side save sync so progress follows you between devices.
3. Gate it behind CloverVault/auth and publish as a CloverStack product tier.
4. Bolt on server-side save sync using the `/saves` volume.

## 9. License and attribution

CloverArcade's own code is **GPL-3.0-or-later** (`LICENSE`) for compatibility
with EmulatorJS. Full per-component credits in [`NOTICE.md`](NOTICE.md).
No ROMs or BIOS files are distributed. The MyClover.Tech name and clover mark
are trademarks of MyClover Tech LLC.
