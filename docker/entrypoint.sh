#!/usr/bin/env bash
# CloverArcade entrypoint: scan /roms, build /games.json, then hand off to nginx.
set -euo pipefail

HTML_DIR="/usr/share/nginx/html"
ROM_DIR="/roms"
OUT="${HTML_DIR}/games.json"

# system directory name -> EmulatorJS/libretro core
core_for_system() {
  case "$1" in
    nes|fds|famicom)              echo "nes" ;;
    snes|sfc|superfamicom)        echo "snes" ;;
    n64|nintendo64)               echo "n64" ;;
    gb|gameboy)                   echo "gb" ;;
    gbc)                          echo "gb" ;;
    gba)                          echo "gba" ;;
    nds|ds)                       echo "nds" ;;
    vb|virtualboy)                echo "vb" ;;
    genesis|megadrive|md|segacd|sega32x) echo "segaMD" ;;
    sms|mastersystem)             echo "segaMS" ;;
    gg|gamegear)                  echo "segaGG" ;;
    saturn)                       echo "segaSaturn" ;;
    psx|ps1|playstation)          echo "psx" ;;
    psp)                          echo "psp" ;;
    atari2600|a26)                echo "atari2600" ;;
    atari5200)                    echo "atari5200" ;;
    atari7800)                    echo "atari7800" ;;
    lynx)                         echo "lynx" ;;
    jaguar)                       echo "jaguar" ;;
    pce|tg16|pcengine)            echo "pce" ;;
    ngp|neogeopocket)             echo "ngp" ;;
    ws|wonderswan)                echo "ws" ;;
    coleco|colecovision)          echo "coleco" ;;
    c64|vic20|plus4|c128)         echo "vice_x64sc" ;;
    amiga)                        echo "amiga" ;;
    dos)                          echo "dosbox_pure" ;;
    3do)                          echo "3do" ;;
    arcade|mame|neogeo|cps1|cps2|cps3) echo "arcade" ;;
    *)                            echo "" ;;
  esac
}

pretty_title() {
  # strip extension, replace separators, drop ROM-set tags like (USA) [!]
  local n="${1%.*}"
  n="${n//_/ }"
  n="${n//./ }"
  n="$(printf '%s' "$n" | sed -E 's/\[[^]]*\]//g; s/\(([A-Za-z0-9!,. -]{1,20})\)$//; s/  +/ /g; s/^ +| +$//g')"
  printf '%s' "$n"
}

build_manifest() {
  local tmp
  tmp="$(mktemp)"
  printf '[]' > "$tmp"

  if [ -d "$ROM_DIR" ]; then
    while IFS= read -r -d '' rom; do
      local rel system base ext core title art artpath
      rel="${rom#"$ROM_DIR"/}"
      system="${rel%%/*}"
      [ "$system" = "$rel" ] && continue                 # loose file at /roms root -> skip
      case "$rel" in */boxart/*|*/media/*) continue ;; esac
      base="$(basename "$rom")"
      case "$base" in README*|readme*|*.md.txt) continue ;; esac
      # note: .md = Sega Mega Drive ROM, so it is NOT treated as markdown
      ext="${base##*.}"
      case "$(printf '%s' "$ext" | tr 'A-Z' 'a-z')" in
        txt|json|jpg|jpeg|png|webp|srm|state|sav|cfg|xml|dat|nfo|db) continue ;;
      esac
      core="$(core_for_system "$(printf '%s' "$system" | tr 'A-Z' 'a-z')")"
      [ -z "$core" ] && core="arcade"
      title="$(pretty_title "$base")"

      art=""
      for cand in "png" "jpg" "jpeg" "webp"; do
        artpath="${ROM_DIR}/${system}/boxart/${base%.*}.${cand}"
        if [ -f "$artpath" ]; then
          art="roms/${system}/boxart/${base%.*}.${cand}"
          break
        fi
      done

      jq --arg t "$title" --arg s "$system" --arg c "$core" \
         --arg p "roms/${rel}" --arg a "$art" \
         --argjson z "$(stat -c %s "$rom")" \
         '. += [{title:$t, system:$s, core:$c, path:$p, art:$a, size:$z}]' \
         "$tmp" > "${tmp}.n" && mv "${tmp}.n" "$tmp"
    done < <(find "$ROM_DIR" -type f -print0 2>/dev/null | sort -z)
  fi

  jq --arg name "${ARCADE_NAME:-CloverArcade}" \
     --arg tag "${ARCADE_TAGLINE:-Insert Coin}" \
     --arg built "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
     --argjson threads "${ARCADE_THREADS:-4}" \
     --arg mame "${MAME_CABINET_URL:-}" \
     '{name:$name, tagline:$tag, generated:$built, threads:$threads, mame_url:$mame, games:(sort_by(.system, .title))}' \
     "$tmp" > "$OUT"
  rm -f "$tmp"

  echo "[OK] CloverArcade manifest: $(jq '.games | length' "$OUT") game(s) across $(jq -r '[.games[].system] | unique | length' "$OUT") system(s)"
}

build_manifest

# optional: rescan every ROM_RESCAN_SECONDS (0 = off)
if [ "${ROM_RESCAN_SECONDS:-0}" -gt 0 ] 2>/dev/null; then
  ( while sleep "${ROM_RESCAN_SECONDS}"; do build_manifest || echo "[WARN] rescan failed"; done ) &
fi

exec "$@"
