/* CloverArcade front-end -- reads games.json, renders cabinets, boots EmulatorJS. */
(function () {
  "use strict";

  var state = { games: [], system: "ALL", query: "", threads: 4, uploads: false };

  var BUILT_INS = [
    {
      title: "Beard Lizard",
      system: "clover",
      kind: "html5",
      core: "html5",
      path: "games/beard-lizard/index.html",
      art: "games/beard-lizard/boxart.svg",
      size: 0
    }
  ];

  function withBuiltIns(games) {
    var seen = {};
    games.forEach(function (g) { seen[g.path] = true; });
    return BUILT_INS.filter(function (g) { return !seen[g.path]; }).concat(games);
  }

  var el = {
    grid: document.getElementById("grid"),
    empty: document.getElementById("empty"),
    systems: document.getElementById("systems"),
    search: document.getElementById("search"),
    count: document.getElementById("game-count"),
    name: document.getElementById("arcade-name"),
    tagline: document.getElementById("arcade-tagline"),
    player: document.getElementById("player"),
    game: document.getElementById("game"),
    nowPlaying: document.getElementById("now-playing"),
    exit: document.getElementById("exit"),
    cabinet: document.getElementById("mame-cabinet")
  };

  var SYSTEM_LABELS = {
    nes: "NES", snes: "SNES", n64: "N64", gb: "Game Boy", gbc: "Game Boy Color",
    gba: "GBA", nds: "DS", genesis: "Genesis", megadrive: "Mega Drive", sms: "Master System",
    gg: "Game Gear", saturn: "Saturn", psx: "PlayStation", psp: "PSP", arcade: "Arcade",
    mame: "MAME", neogeo: "Neo Geo", pce: "PC Engine", atari2600: "Atari 2600", dos: "DOS",
    c64: "C64", amiga: "Amiga", clover: "Clover"
  };

  function label(sys) {
    var k = String(sys).toLowerCase();
    return SYSTEM_LABELS[k] || sys.toUpperCase();
  }

  function humanSize(bytes) {
    if (!bytes) return "";
    var u = ["B", "KB", "MB", "GB"], i = 0, n = bytes;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)) + " " + u[i];
  }

  function renderChips() {
    var systems = ["ALL"].concat(
      state.games.map(function (g) { return g.system; })
        .filter(function (v, i, a) { return a.indexOf(v) === i; })
        .sort()
    );
    el.systems.innerHTML = "";
    systems.forEach(function (sys) {
      var b = document.createElement("button");
      b.className = "chip";
      b.type = "button";
      b.textContent = sys === "ALL" ? "All Systems" : label(sys);
      b.setAttribute("aria-pressed", String(state.system === sys));
      b.addEventListener("click", function () {
        state.system = sys;
        renderChips();
        renderGrid();
      });
      el.systems.appendChild(b);
    });
  }

  function visibleGames() {
    var q = state.query.trim().toLowerCase();
    return state.games.filter(function (g) {
      if (state.system !== "ALL" && g.system !== state.system) return false;
      if (!q) return true;
      return (g.title + " " + g.system).toLowerCase().indexOf(q) !== -1;
    });
  }

  function cabinet(g) {
    var card = document.createElement("button");
    card.className = "cab";
    card.type = "button";

    var art;
    if (g.art) {
      art = document.createElement("img");
      art.className = "cab-art";
      art.loading = "lazy";
      art.alt = g.title;
      art.src = encodeURI(g.art);
      art.addEventListener("error", function () {
        card.replaceChild(fallbackArt(), art);
      });
    } else {
      art = fallbackArt();
    }
    card.appendChild(art);

    var play = document.createElement("div");
    play.className = "cab-play";
    play.innerHTML = "<span>PLAY</span>";
    card.appendChild(play);

    var meta = document.createElement("div");
    meta.className = "cab-meta";
    var t = document.createElement("p");
    t.className = "cab-title";
    t.textContent = g.title;
    var s = document.createElement("div");
    s.className = "cab-sys";
    s.textContent = label(g.system);
    var z = document.createElement("span");
    z.className = "cab-size";
    z.textContent = g.kind === "html5" ? "BUILT-IN" : humanSize(g.size);
    s.appendChild(z);
    meta.appendChild(t);
    meta.appendChild(s);
    card.appendChild(meta);

    card.addEventListener("click", function () { launch(g); });
    return card;
  }

  function fallbackArt() {
    var d = document.createElement("div");
    d.className = "cab-art-fallback";
    var i = document.createElement("img");
    i.src = "assets/logo.webp";
    i.alt = "";
    d.appendChild(i);
    return d;
  }

  function renderGrid() {
    var games = visibleGames();
    el.grid.innerHTML = "";
    games.forEach(function (g) { el.grid.appendChild(cabinet(g)); });
    el.empty.hidden = state.games.length !== 0;
    el.grid.hidden = games.length === 0;
  }

  /* ---------- EmulatorJS boot ---------- */
  function launch(g) {
    if (g.kind === "html5") return launchHtml(g);
    el.nowPlaying.textContent = g.title + "  [" + label(g.system) + "]";
    var hint = document.getElementById("player-hint");
    if (hint) hint.textContent = "F = fullscreen  ·  ESC = menu";
    el.player.hidden = false;
    document.body.style.overflow = "hidden";

    el.game.innerHTML = "";
    var div = document.createElement("div");
    div.id = "ejs-target";
    el.game.appendChild(div);

    window.EJS_player = "#ejs-target";
    window.EJS_core = g.core;
    window.EJS_gameUrl = encodeURI(g.path);
    window.EJS_gameName = g.title;
    window.EJS_pathtodata = "emulatorjs/data/";
    window.EJS_startOnLoaded = true;
    window.EJS_color = "#e8bf4a";
    window.EJS_threads = state.threads > 1;
    window.EJS_language = "en-US";
    window.EJS_defaultOptions = { "save-state-location": "browser" };

    var s = document.createElement("script");
    s.src = "emulatorjs/data/loader.js";
    s.onerror = function () {
      el.game.innerHTML =
        '<p style="padding:24px;color:#e0322f">EmulatorJS assets not found at emulatorjs/data/. ' +
        "Rebuild the image so the EmulatorJS release is baked in.</p>";
    };
    document.body.appendChild(s);
    window.__ejsScript = s;
  }

  function launchHtml(g) {
    el.nowPlaying.textContent = g.title + "  [" + label(g.system) + "]";
    var hint = document.getElementById("player-hint");
    if (hint) hint.textContent = "ARROWS / WASD MOVE  ·  SPACE BEARD";
    el.player.hidden = false;
    document.body.style.overflow = "hidden";
    el.game.innerHTML = "";
    var frame = document.createElement("iframe");
    frame.className = "html5-frame";
    frame.src = encodeURI(g.path);
    frame.title = g.title;
    frame.setAttribute("allow", "autoplay; fullscreen");
    frame.addEventListener("load", function () { frame.focus(); });
    el.game.appendChild(frame);
  }

  function exitGame() {
    // hard reset: emulator cores keep audio/RAF alive otherwise
    window.location.reload();
  }

  el.exit.addEventListener("click", exitGame);
  el.search.addEventListener("input", function (e) {
    state.query = e.target.value;
    renderGrid();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && el.player.hidden && document.activeElement !== el.search) {
      e.preventDefault();
      el.search.focus();
    }
  });

  // The MAME cabinet runs in a sibling container on the same host. "auto" (or a
  // bare ":8089") is resolved against whatever hostname the browser used, so the
  // stack needs no host-specific configuration to work across a LAN.
  function resolveCabinetUrl(value) {
    if (!value) return "";
    var v = String(value).trim();
    if (!v) return "";
    if (v.charAt(0) === ":") return window.location.protocol + "//" + window.location.hostname + v;
    if (v.toLowerCase() === "auto") return window.location.protocol + "//" + window.location.hostname + ":8089";
    return v;
  }

  function loadManifest() {
  return fetch("games.json", { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      state.games = withBuiltIns(data.games || []);
      state.threads = data.threads || 4;
      if (data.name) el.name.textContent = data.name.toUpperCase();
      if (data.tagline) el.tagline.textContent = data.tagline.toUpperCase();
      var mame = resolveCabinetUrl(data.mame_url);
      if (mame) {
        el.cabinet.href = mame;
        el.cabinet.hidden = false;
      }
      state.uploads = !!data.uploads;
      if (window.CloverUpload) window.CloverUpload.setEnabled(state.uploads);
      el.count.textContent = state.games.length;
      document.title = (data.name || "CloverArcade");
      renderChips();
      renderGrid();
    })
    .catch(function () {
      state.games = withBuiltIns([]);
      el.count.textContent = String(state.games.length);
      el.empty.hidden = state.games.length !== 0;
      el.grid.hidden = state.games.length === 0;
      renderChips();
      renderGrid();
    });
  }

  window.CloverArcade = { reload: loadManifest };
  loadManifest();
})();
