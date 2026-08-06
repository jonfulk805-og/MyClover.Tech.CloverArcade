#!/usr/bin/env python3
"""CloverArcade upload service.

A deliberately tiny stdlib-only HTTP service that lets the arcade front-end add
ROMs and box art without shell access. It sits on 127.0.0.1 and is reached only
through nginx at /api/.

Design rules:
  * streaming writes -- a 4 GB ISO never lands in memory
  * token auth, and uploads are DISABLED unless UPLOAD_TOKEN is set
  * filename sanitising and an extension allowlist, no path traversal
  * a rescan flag file so the manifest picks up new games within seconds

Endpoints
  GET    /api/status                                  -> capabilities + systems
  PUT    /api/upload?system=nes&name=Game.nes&kind=rom
  POST   /api/boxart?system=nes                       -> fetch missing cover art
  DELETE /api/rom?path=roms/nes/Game.nes
  POST   /api/rescan
"""

import difflib
import html
import json
import os
import re
import shutil
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROM_DIR = os.environ.get("ROM_DIR", "/roms")
RESCAN_FLAG = os.environ.get("RESCAN_FLAG", "/tmp/cloverarcade.rescan")
TOKEN = os.environ.get("UPLOAD_TOKEN", "").strip()
MAX_BYTES = int(os.environ.get("UPLOAD_MAX_BYTES", str(8 * 1024 * 1024 * 1024)))
LISTEN_PORT = int(os.environ.get("UPLOAD_PORT", "8081"))

# Keep in sync with core_for_system() in entrypoint.sh.
SYSTEMS = [
    "arcade", "nes", "snes", "n64", "gb", "gbc", "gba", "nds", "vb",
    "genesis", "segacd", "sega32x", "sms", "gg", "saturn",
    "psx", "psp", "atari2600", "atari5200", "atari7800", "lynx", "jaguar",
    "pce", "ngp", "ws", "coleco", "c64", "amiga", "dos", "3do", "neogeo",
    "cps1", "cps2", "cps3", "bios",
]

ART_EXT = {"png", "jpg", "jpeg", "webp"}

# Box art comes from the libretro thumbnail archive -- a community effort by the
# libretro team and contributors. https://thumbnails.libretro.com/
THUMB_BASE = os.environ.get("THUMBNAIL_BASE", "https://thumbnails.libretro.com")
THUMB_PLATFORM = {
    "nes": "Nintendo - Nintendo Entertainment System",
    "fds": "Nintendo - Family Computer Disk System",
    "snes": "Nintendo - Super Nintendo Entertainment System",
    "n64": "Nintendo - Nintendo 64",
    "gb": "Nintendo - Game Boy",
    "gbc": "Nintendo - Game Boy Color",
    "gba": "Nintendo - Game Boy Advance",
    "nds": "Nintendo - Nintendo DS",
    "vb": "Nintendo - Virtual Boy",
    "genesis": "Sega - Mega Drive - Genesis",
    "segacd": "Sega - Mega-CD - Sega CD",
    "sega32x": "Sega - 32X",
    "sms": "Sega - Master System - Mark III",
    "gg": "Sega - Game Gear",
    "saturn": "Sega - Saturn",
    "psx": "Sony - PlayStation",
    "psp": "Sony - PlayStation Portable",
    "atari2600": "Atari - 2600",
    "atari5200": "Atari - 5200",
    "atari7800": "Atari - 7800",
    "lynx": "Atari - Lynx",
    "jaguar": "Atari - Jaguar",
    "pce": "NEC - PC Engine - TurboGrafx 16",
    "ngp": "SNK - Neo Geo Pocket",
    "ws": "Bandai - WonderSwan",
    "coleco": "Coleco - ColecoVision",
    "c64": "Commodore - 64",
    "amiga": "Commodore - Amiga",
    "3do": "The 3DO Company - 3DO",
    "dos": "DOS",
    "arcade": "MAME",
    "neogeo": "SNK - Neo Geo",
}
_INDEX_CACHE = {}
BLOCKED_EXT = {
    "exe", "dll", "so", "sh", "bash", "bat", "cmd", "ps1", "com", "msi",
    "py", "pl", "rb", "php", "js", "html", "htm", "svg", "jar",
}

_SAFE = re.compile(r"[^A-Za-z0-9 ._()\[\]!&+,'-]")


def safe_name(raw):
    """Reduce an arbitrary client filename to a harmless basename."""
    name = os.path.basename((raw or "").replace("\\", "/")).strip()
    name = _SAFE.sub("_", name)
    name = name.lstrip(".")           # no dotfiles, no '..'
    name = re.sub(r"_{2,}", "_", name)
    return name[:180]


def ext_of(name):
    return name.rsplit(".", 1)[-1].lower() if "." in name else ""


def normalise(title):
    """Loose key for matching ROM names to thumbnail names."""
    t = title.lower()
    t = re.sub(r"\.[a-z0-9]{1,4}$", "", t)
    t = re.sub(r"\[[^]]*\]|\([^)]*\)", " ", t)
    t = re.sub(r"\b(usa|europe|japan|world|rev [0-9a-z]+|v[0-9.]+)\b", " ", t)
    t = t.replace("&", "and")
    t = re.sub(r"[^a-z0-9]+", " ", t)
    return " ".join(t.split())


def thumbnail_index(platform):
    """Filenames in a platform's Named_Boxarts folder, cached per process."""
    if platform in _INDEX_CACHE:
        return _INDEX_CACHE[platform]
    url = "%s/%s/Named_Boxarts/" % (THUMB_BASE, urllib.parse.quote(platform))
    req = urllib.request.Request(url, headers={"User-Agent": "CloverArcade"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        page = resp.read().decode("utf-8", "replace")
    names = []
    for href in re.findall(r'href="([^"]+\.png)"', page):
        names.append(html.unescape(urllib.parse.unquote(href.split("/")[-1])))
    _INDEX_CACHE[platform] = names
    log("[OK] thumbnail index for %s: %d covers" % (platform, len(names)))
    return names


BAD_TAGS = ("[h", "[b", "[o", "[p", "[t", "(sample", "(beta", "(proto",
            "(demo", "(hack", "(pirate", "(unl", "(alt", "(aftermarket")


def cover_score(name):
    """Higher is better: prefer clean USA/World retail scans over hacks."""
    low = name.lower()
    score = 0
    if "(usa" in low:
        score += 40
    elif "(world" in low:
        score += 35
    elif "(europe" in low:
        score += 25
    elif "(japan" in low:
        score += 15
    for tag in BAD_TAGS:
        if tag in low:
            score -= 30
    if "rev " in low:
        score -= 2
    score -= len(name) / 200.0          # tie-break toward the plainer filename
    return score


def best_cover(rom_name, names, keys):
    want = normalise(rom_name)
    if not want:
        return None
    candidates = keys.get(want)
    if not candidates:
        hit = difflib.get_close_matches(want, list(keys.keys()), n=1, cutoff=0.90)
        candidates = keys.get(hit[0]) if hit else None
    if not candidates:
        return None
    return sorted(candidates, key=cover_score, reverse=True)[0]


def fetch_boxart(system):
    """Download covers for every ROM in one system that has no art yet."""
    system = (system or "").strip().lower()
    platform = THUMB_PLATFORM.get(system)
    if not platform:
        raise Denied(400, "no thumbnail archive mapping for '%s'" % system)
    sysdir = os.path.join(ROM_DIR, system)
    if not os.path.isdir(sysdir):
        raise Denied(404, "no roms/%s directory yet" % system)
    artdir = os.path.join(sysdir, "boxart")

    roms = []
    for entry in sorted(os.listdir(sysdir)):
        full = os.path.join(sysdir, entry)
        if not os.path.isfile(full):
            continue
        ext = ext_of(entry)
        if ext in ART_EXT or ext in ("txt", "json", "srm", "state", "sav"):
            continue
        stem = entry.rsplit(".", 1)[0]
        have = any(os.path.isfile(os.path.join(artdir, stem + "." + e)) for e in ART_EXT)
        if not have:
            roms.append((entry, stem))

    if not roms:
        return {"ok": True, "system": system, "checked": 0, "downloaded": 0,
                "missing": [], "note": "every game already has cover art"}

    names = thumbnail_index(platform)
    keys = {}
    for n in names:
        keys.setdefault(normalise(n), []).append(n)

    os.makedirs(artdir, exist_ok=True)
    got, missing = 0, []
    for entry, stem in roms:
        cover = best_cover(entry, names, keys)
        if not cover:
            missing.append(entry)
            continue
        url = "%s/%s/Named_Boxarts/%s" % (THUMB_BASE, urllib.parse.quote(platform),
                                          urllib.parse.quote(cover))
        target = os.path.join(artdir, stem + ".png")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "CloverArcade"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
            fd, tmp = tempfile.mkstemp(dir=artdir, prefix=".art-")
            with os.fdopen(fd, "wb") as fh:
                fh.write(data)
            os.chmod(tmp, 0o644)
            os.replace(tmp, target)
            got += 1
            log("[OK] cover for %s <- %s" % (entry, cover))
        except (urllib.error.URLError, OSError) as exc:
            missing.append(entry)
            log("[WARN] cover failed for %s: %s" % (entry, exc))
    if got:
        flag_rescan()
    return {"ok": True, "system": system, "platform": platform,
            "checked": len(roms), "downloaded": got, "missing": missing,
            "source": "libretro thumbnail archive"}


class Denied(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


def target_path(system, name, kind):
    if not TOKEN:
        raise Denied(403, "uploads are disabled -- set UPLOAD_TOKEN to enable")
    system = (system or "").strip().lower()
    if system not in SYSTEMS:
        raise Denied(400, "unknown system '%s'" % system)
    name = safe_name(name)
    if not name:
        raise Denied(400, "missing or unusable filename")
    ext = ext_of(name)
    if not ext:
        raise Denied(400, "filename needs an extension")
    if ext in BLOCKED_EXT:
        raise Denied(400, "'.%s' files are not accepted here" % ext)
    if kind == "art":
        if ext not in ART_EXT:
            raise Denied(400, "box art must be png, jpg, jpeg or webp")
        directory = os.path.join(ROM_DIR, system, "boxart")
    else:
        if ext in ART_EXT:
            raise Denied(400, "that looks like an image -- upload it as box art")
        directory = os.path.join(ROM_DIR, system)
    full = os.path.join(directory, name)
    root = os.path.realpath(ROM_DIR)
    if not os.path.realpath(os.path.dirname(full)).startswith(root):
        raise Denied(400, "refusing to write outside the ROM directory")
    return directory, full, name


def stream_to_disk(stream, length, directory, full):
    os.makedirs(directory, exist_ok=True)
    if length > MAX_BYTES:
        raise Denied(413, "file is larger than the %d byte limit" % MAX_BYTES)
    fd, tmp = tempfile.mkstemp(dir=directory, prefix=".upload-")
    written = 0
    try:
        with os.fdopen(fd, "wb") as out:
            remaining = length
            while remaining > 0:
                chunk = stream.read(min(1024 * 1024, remaining))
                if not chunk:
                    raise Denied(400, "upload ended early -- nothing was saved")
                out.write(chunk)
                written += len(chunk)
                remaining -= len(chunk)
        os.chmod(tmp, 0o644)
        os.replace(tmp, full)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
    return written


def flag_rescan():
    try:
        with open(RESCAN_FLAG, "w", encoding="utf-8") as fh:
            fh.write("rescan\n")
    except OSError as exc:
        log("[WARN] could not write rescan flag: %s" % exc)


def log(msg):
    sys.stdout.write("%s\n" % msg)
    sys.stdout.flush()


def disk_free():
    try:
        usage = shutil.disk_usage(ROM_DIR)
        return {"free_bytes": usage.free, "total_bytes": usage.total}
    except OSError:
        return {"free_bytes": None, "total_bytes": None}


class Handler(BaseHTTPRequestHandler):
    server_version = "CloverArcade"
    sys_version = ""
    protocol_version = "HTTP/1.1"

    # -- helpers ---------------------------------------------------------
    def reply(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if code >= 400:
            # We may be rejecting before the body was read (e.g. an oversize
            # file). Close rather than leave a half-read request on the socket.
            self.send_header("Connection", "close")
            self.close_connection = True
        self.end_headers()
        try:
            self.wfile.write(body)
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def check_token(self):
        if not TOKEN:
            raise Denied(403, "uploads are disabled -- set UPLOAD_TOKEN to enable")
        given = self.headers.get("X-Clover-Token", "")
        if given != TOKEN:
            raise Denied(401, "wrong or missing upload token")

    def query(self):
        return parse_qs(urlparse(self.path).query)

    def route(self):
        return urlparse(self.path).path.rstrip("/") or "/"

    def log_message(self, fmt, *args):
        log("-- %s %s" % (self.command, self.path.split("?")[0]))

    def guarded(self, fn):
        try:
            fn()
        except Denied as exc:
            self.reply(exc.code, {"ok": False, "error": exc.message})
        except Exception as exc:                      # noqa: BLE001
            log("[WARN] %s: %s" % (type(exc).__name__, exc))
            self.reply(500, {"ok": False, "error": "internal error: %s" % exc})

    # -- verbs -----------------------------------------------------------
    def do_GET(self):
        def run():
            if self.route() != "/api/status":
                raise Denied(404, "no such endpoint")
            payload = {
                "ok": True,
                "uploads_enabled": bool(TOKEN),
                "systems": SYSTEMS,
                "max_bytes": MAX_BYTES,
                "art_extensions": sorted(ART_EXT),
                "art_systems": sorted(THUMB_PLATFORM.keys()),
            }
            payload.update(disk_free())
            self.reply(200, payload)
        self.guarded(run)

    def do_PUT(self):
        def run():
            if self.route() != "/api/upload":
                raise Denied(404, "no such endpoint")
            self.check_token()
            q = self.query()
            system = (q.get("system") or [""])[0]
            name = (q.get("name") or [""])[0]
            kind = (q.get("kind") or ["rom"])[0]
            if kind not in ("rom", "art"):
                raise Denied(400, "kind must be 'rom' or 'art'")
            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0:
                raise Denied(400, "empty upload")
            directory, full, final = target_path(system, name, kind)
            written = stream_to_disk(self.rfile, length, directory, full)
            flag_rescan()
            log("[OK] stored %s (%d bytes)" % (full, written))
            self.reply(201, {"ok": True, "system": system.lower(),
                             "name": final, "bytes": written, "kind": kind})
        self.guarded(run)

    def do_DELETE(self):
        def run():
            if self.route() != "/api/rom":
                raise Denied(404, "no such endpoint")
            self.check_token()
            rel = (self.query().get("path") or [""])[0]
            rel = rel.lstrip("/")
            if rel.startswith("roms/"):
                rel = rel[len("roms/"):]
            if not rel or ".." in rel.split("/"):
                raise Denied(400, "bad path")
            full = os.path.join(ROM_DIR, rel)
            root = os.path.realpath(ROM_DIR)
            if not os.path.realpath(full).startswith(root):
                raise Denied(400, "refusing to touch anything outside the ROM directory")
            if not os.path.isfile(full):
                raise Denied(404, "no such file")
            os.unlink(full)
            flag_rescan()
            log("[OK] deleted %s" % full)
            self.reply(200, {"ok": True, "deleted": rel})
        self.guarded(run)

    def do_POST(self):
        def run():
            route = self.route()
            if route == "/api/rescan":
                self.check_token()
                flag_rescan()
                self.reply(202, {"ok": True, "rescan": "queued"})
                return
            if route == "/api/boxart":
                self.check_token()
                system = (self.query().get("system") or [""])[0]
                self.reply(200, fetch_boxart(system))
                return
            raise Denied(404, "no such endpoint")
        self.guarded(run)


def main():
    if not TOKEN:
        log("[WARN] UPLOAD_TOKEN is not set -- upload API will refuse every write")
    log("[OK] CloverArcade upload service on 127.0.0.1:%d (rom_dir=%s)"
        % (LISTEN_PORT, ROM_DIR))
    ThreadingHTTPServer(("127.0.0.1", LISTEN_PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
