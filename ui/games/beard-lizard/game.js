/* Beard Lizard — eat every bug to clear the level. Avoid the predators.
   Arrows / WASD move. Space flares your beard and scares them off. */
(function () {
  "use strict";

  var COLS = 24;
  var ROWS = 14;
  var TILE = 24;
  var HUD = 40;
  var W = COLS * TILE;
  var H = ROWS * TILE;
  var VIEW_H = H + HUD;
  var PLAYER_SPEED = 118;
  var FLARE_TIME = 0.62;
  var FLARE_CD = 5.2;
  var FLARE_RADIUS = 74;
  var FEAR_TIME = 2.35;

  var THEMES = {
    day: { sky: "#f0d7a4", sand: ["#e7c98a", "#dcb56e", "#efd7a2"], rock: "#6e5844", rockHi: "#a88b68", bush: "#3f7a3a", bushHi: "#6aaa4e" },
    night: { sky: "#1a2030", sand: ["#2c3348", "#343c54", "#262c40"], rock: "#171b28", rockHi: "#46506c", bush: "#1c3a34", bushHi: "#3d6a58" },
    scrub: { sky: "#d5c49a", sand: ["#cbb98a", "#bfa56e", "#d8c79a"], rock: "#6a5a40", rockHi: "#9a8460", bush: "#2f6b32", bushHi: "#5ea04a" },
    dump: { sky: "#8d867c", sand: ["#8a8072", "#7a7268", "#948878"], rock: "#4a4744", rockHi: "#7a756e", bush: "#3d5a32", bushHi: "#6a8a48" },
    outback: { sky: "#e7b07a", sand: ["#e0a15c", "#d08a48", "#efb878"], rock: "#7a4030", rockHi: "#b46a48", bush: "#6a7030", bushHi: "#9aaa4c" }
  };

  var LEVELS = [
    {
      name: "BACKYARD",
      theme: "day",
      tip: "Eat every bug. Stay off the snake.",
      snakes: [{ path: [[19, 2], [21, 2], [21, 11], [19, 11]], speed: 50, segs: 8 }],
      rows: [
        "########################",
        "#S.......c.............#",
        "#......................#",
        "#......###......c......#",
        "#......###.............#",
        "#..............b.......#",
        "#....c.................#",
        "#......................#",
        "#..........##......c...#",
        "#..........##..........#",
        "#..c................b..#",
        "#......................#",
        "#.............c........#",
        "########################"
      ]
    },
    {
      name: "ROCK GARDEN",
      theme: "day",
      tip: "Cats crouch, then pounce. Step aside.",
      snakes: [{ path: [[18, 6], [20, 6], [20, 12], [18, 12]], speed: 58, segs: 8 }],
      rows: [
        "########################",
        "#S......##......c......#",
        "#.......##.............#",
        "#..c....##......##..b..#",
        "#..............##......#",
        "#..####..............###",
        "#..#.....K............##",
        "#..#..c..........b.....#",
        "#..####..............c.#",
        "#......................#",
        "#.....##....####.......#",
        "#..c..##....#..........#",
        "#......##....#...b.....#",
        "########################"
      ]
    },
    {
      name: "MOONLIGHT",
      theme: "night",
      tip: "When the hawk shadow locks, step out.",
      snakes: [{ path: [[21, 11], [2, 11], [2, 2], [21, 2]], speed: 64, segs: 12 }],
      rows: [
        "########################",
        "#S.....................#",
        "#......m........m......#",
        "#........##............#",
        "#........##.....m......#",
        "#......................#",
        "#..m........H..........#",
        "#......................#",
        "#.....m..........##....#",
        "#..............##......#",
        "#..m...............m...#",
        "#............m.........#",
        "#......................#",
        "########################"
      ]
    },
    {
      name: "THE SCRUB",
      theme: "scrub",
      tip: "The goanna is slow. Don't get cornered.",
      snakes: [{ path: [[16, 2], [21, 2], [21, 4], [16, 4]], speed: 62, segs: 6 }],
      rows: [
        "########################",
        "#S......*.....c........#",
        "#....**.*..............#",
        "#..c..*........b...*...#",
        "#.......**.............#",
        "#........*....G........#",
        "#..b.............**....#",
        "#......*....m......*...#",
        "#..*........K......*...#",
        "#.....**...............#",
        "#..c........*.....b....#",
        "#.......*..............#",
        "#....m........*....c...#",
        "########################"
      ]
    },
    {
      name: "THE TIP",
      theme: "dump",
      tip: "Roaches dash. Pin them against the rocks.",
      snakes: [{ path: [[18, 9], [21, 9], [21, 12], [18, 12]], speed: 70, segs: 6 }],
      rows: [
        "########################",
        "#S....##..........r....#",
        "#......##..r...........#",
        "#..r...##......###.....#",
        "#..........K...###..b..#",
        "#..####..............###",
        "#..#..................##",
        "#..#..c......H...r.....#",
        "#..####..............c.#",
        "#......................#",
        "#.....##....####.......#",
        "#..r..##....#..........#",
        "#......##....#...b.....#",
        "########################"
      ]
    },
    {
      name: "RED OUTBACK",
      theme: "outback",
      tip: "All of them are out. Flare, then run.",
      snakes: [{ path: [[2, 8], [2, 11], [9, 11], [9, 8]], speed: 76, segs: 8 }],
      rows: [
        "########################",
        "#S.......c......m......#",
        "#......................#",
        "#....###...............#",
        "#....###....G....r.....#",
        "#....###...............#",
        "#..c......K............#",
        "#.................H....#",
        "#...............###....#",
        "#....m..........###..b.#",
        "#......b........###....#",
        "#..r...............c...#",
        "#......................#",
        "########################"
      ]
    }
  ];

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var keys = {};
  var stick = { id: null, dx: 0, dy: 0 };
  var viewScale = 1;
  var dpr = 1;

  var mode = "title";
  var levelIndex = 0;
  var levelName = "";
  var levelTip = "";
  var theme = THEMES.day;
  var tiles = [];
  var heat = 0;
  var score = 0;
  var best = loadBest();
  var lives = 3;
  var time = 0;
  var shake = 0;
  var intro = 0;
  var invuln = 0;
  var flare = 0;
  var flareCd = 0;
  var chain = 0;
  var chainT = 0;
  var clearT = 0;
  var muted = false;
  var totalBugs = 0;
  var player = null;
  var bugs = [];
  var snakes = [];
  var cats = [];
  var hawks = [];
  var goannas = [];
  var particles = [];
  var floaters = [];
  var actx = null;
  var lastTs = 0;

  function loadBest() {
    try { return parseInt(localStorage.getItem("cloverarcade.beard-lizard.best") || "0", 10) || 0; }
    catch (e) { return 0; }
  }

  function saveBest() {
    if (score > best) best = score;
    try { localStorage.setItem("cloverarcade.beard-lizard.best", String(best)); }
    catch (e) {}
  }

  function speedMul() {
    return 1 + heat * 0.15;
  }

  function tileCenter(tx, ty) {
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
  }

  function solidAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
    var ch = tiles[ty][tx];
    return ch === "#" || ch === "*";
  }

  function hitsSolid(px, py, rad) {
    var x0 = Math.floor((px - rad) / TILE);
    var x1 = Math.floor((px + rad) / TILE);
    var y0 = Math.floor((py - rad) / TILE);
    var y1 = Math.floor((py + rad) / TILE);
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        if (!solidAt(x, y)) continue;
        var nx = Math.max(x * TILE, Math.min(px, x * TILE + TILE));
        var ny = Math.max(y * TILE, Math.min(py, y * TILE + TILE));
        var dx = px - nx;
        var dy = py - ny;
        if (dx * dx + dy * dy < rad * rad) return true;
      }
    }
    return false;
  }

  function moveBody(ent, vx, vy, dt) {
    var nx = ent.x + vx * dt;
    if (!hitsSolid(nx, ent.y, ent.r)) ent.x = nx;
    var ny = ent.y + vy * dt;
    if (!hitsSolid(ent.x, ny, ent.r)) ent.y = ny;
  }

  function clampSpeed(vx, vy, max) {
    var m = Math.hypot(vx, vy);
    if (m > max) return { x: vx / m * max, y: vy / m * max };
    return { x: vx, y: vy };
  }

  function los(x1, y1, x2, y2) {
    var dist = Math.hypot(x2 - x1, y2 - y1);
    var steps = Math.ceil(dist / 6);
    for (var i = 1; i < steps; i++) {
      var t = i / steps;
      var x = x1 + (x2 - x1) * t;
      var y = y1 + (y2 - y1) * t;
      if (solidAt(Math.floor(x / TILE), Math.floor(y / TILE))) return false;
    }
    return true;
  }

  function steer(ent, tx, ty, speed, dt) {
    var dx = tx - ent.x;
    var dy = ty - ent.y;
    var d = Math.hypot(dx, dy) || 1;
    if (ent.stuck > 0.4) {
      var a = Math.atan2(dy, dx) + (ent.bias || 1) * Math.PI / 2;
      dx = Math.cos(a);
      dy = Math.sin(a);
      d = 1;
    }
    var beforeX = ent.x;
    var beforeY = ent.y;
    moveBody(ent, dx / d * speed, dy / d * speed, dt);
    if (Math.hypot(ent.x - beforeX, ent.y - beforeY) < speed * dt * 0.2) ent.stuck = (ent.stuck || 0) + dt;
    else ent.stuck = 0;
  }

  function polyLength(pts) {
    var n = 0;
    for (var i = 1; i < pts.length; i++) n += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return n;
  }

  function spawnBug(c, kind) {
    bugs.push({
      x: c.x, y: c.y, r: 5, kind: kind,
      ang: Math.random() * Math.PI * 2,
      age: Math.random() * 2,
      turn: 0.4 + Math.random(),
      phase: Math.random() * 6,
      hopping: false
    });
    tiles[Math.floor(c.y / TILE)][Math.floor(c.x / TILE)] = ".";
  }

  function spawnCat(c) {
    cats.push({
      x: c.x, y: c.y, r: 8, state: "wander", timer: 0,
      tx: c.x, ty: c.y, vx: 0, vy: 0, fear: 0, a: 0,
      stuck: 0, bias: Math.random() < 0.5 ? -1 : 1, hasTarget: false
    });
  }

  function spawnHawk(c, index) {
    hawks.push({
      x: c.x, y: c.y, homeX: c.x, homeY: c.y,
      state: "idle", timer: 1.3 + index * 0.45, fear: 0, r: 14
    });
  }

  function spawnGoanna(c) {
    goannas.push({
      x: c.x, y: c.y, r: 9, fear: 0, a: 0,
      tx: c.x, ty: c.y, stuck: 0, bias: 1, hasTarget: false, wanderT: 0
    });
  }

  function spawnSnake(def) {
    var path = def.path.map(function (p) { return tileCenter(p[0], p[1]); });
    var s = {
      path: path, i: 1, x: path[0].x, y: path[0].y,
      speed: def.speed, segs: def.segs, spacing: 12,
      r: 6.5, fear: 0, trail: []
    };
    var posx = s.x;
    var posy = s.y;
    var idx = path.length - 1;
    var samples = [{ x: posx, y: posy }];
    var guard = 0;
    while (polyLength(samples) < s.segs * s.spacing && guard++ < 5000) {
      var tx = path[idx].x;
      var ty = path[idx].y;
      var dx = tx - posx;
      var dy = ty - posy;
      var dist = Math.hypot(dx, dy);
      if (dist < 2) {
        idx = (idx - 1 + path.length) % path.length;
        continue;
      }
      var step = Math.min(2, dist);
      posx += dx / dist * step;
      posy += dy / dist * step;
      samples.push({ x: posx, y: posy });
    }
    samples.reverse();
    s.trail = samples;
    return s;
  }

  function loadLevel(index) {
    var L = LEVELS[index];
    levelName = L.name;
    levelTip = L.tip;
    theme = THEMES[L.theme];
    tiles = L.rows.map(function (row) { return row.split(""); });
    bugs = [];
    cats = [];
    hawks = [];
    goannas = [];
    particles = [];
    floaters = [];
    var sx = TILE;
    var sy = TILE;
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var ch = tiles[y][x];
        var c = tileCenter(x, y);
        if (ch === "S") { sx = c.x; sy = c.y; tiles[y][x] = "."; }
        else if (ch === "c") spawnBug(c, "cricket");
        else if (ch === "b") spawnBug(c, "beetle");
        else if (ch === "m") spawnBug(c, "moth");
        else if (ch === "r") spawnBug(c, "roach");
        else if (ch === "K") { spawnCat(c); tiles[y][x] = "."; }
        else if (ch === "H") { spawnHawk(c, hawks.length); tiles[y][x] = "."; }
        else if (ch === "G") { spawnGoanna(c); tiles[y][x] = "."; }
      }
    }
    player = { x: sx, y: sy, r: 7, a: 0, moving: false, chomp: 0 };
    snakes = L.snakes.map(spawnSnake);
    intro = 1.55;
    invuln = 1.55;
    flare = 0;
    flareCd = 0;
    chain = 0;
    chainT = 0;
    totalBugs = bugs.length;
  }

  function startGame(keep) {
    if (!keep) {
      score = 0;
      lives = 3;
      heat = 0;
      levelIndex = 0;
    }
    loadLevel(levelIndex);
    mode = "play";
    jingleStart();
  }

  function startHeat() {
    heat += 1;
    levelIndex = 0;
    lives = 3;
    loadLevel(0);
    mode = "play";
    jingleStart();
  }

  function advance() {
    if (levelIndex + 1 >= LEVELS.length) {
      mode = "won";
      saveBest();
      jingleWin();
      return;
    }
    levelIndex += 1;
    loadLevel(levelIndex);
    mode = "play";
  }

  function audio() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
    return actx;
  }

  function tone(freq, dur, type, vol, slide) {
    if (muted) return;
    try {
      var a = audio();
      var o = a.createOscillator();
      var g = a.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, a.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), a.currentTime + dur);
      g.gain.setValueAtTime(vol, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
      o.connect(g);
      g.connect(a.destination);
      o.start();
      o.stop(a.currentTime + dur + 0.02);
    } catch (e) {}
  }

  function noise(dur, vol) {
    if (muted) return;
    try {
      var a = audio();
      var n = Math.max(1, Math.floor(a.sampleRate * dur));
      var buf = a.createBuffer(1, n, a.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var src = a.createBufferSource();
      src.buffer = buf;
      var filter = a.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 700;
      var g = a.createGain();
      g.gain.value = vol;
      src.connect(filter);
      filter.connect(g);
      g.connect(a.destination);
      src.start();
    } catch (e) {}
  }

  function jingleStart() {
    tone(392, 0.08, "square", 0.04, 523);
    setTimeout(function () { tone(523, 0.1, "square", 0.04, 659); }, 90);
  }

  function jingleClear() {
    tone(523, 0.08, "square", 0.045, 659);
    setTimeout(function () { tone(659, 0.08, "square", 0.045, 784); }, 90);
    setTimeout(function () { tone(784, 0.14, "square", 0.045, 1046); }, 180);
  }

  function jingleWin() {
    [523, 659, 784, 1046].forEach(function (f, i) {
      setTimeout(function () { tone(f, 0.12, "square", 0.045); }, i * 110);
    });
  }

  function jingleDead() {
    tone(196, 0.18, "sawtooth", 0.05, 80);
  }

  function burst(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = 20 + Math.random() * 70;
      particles.push({
        x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20,
        life: 0.35 + Math.random() * 0.3, color: color, s: 1.5 + Math.random() * 2
      });
    }
    if (particles.length > 140) particles.splice(0, particles.length - 140);
  }

  function floater(x, y, text, color) {
    floaters.push({ x: x, y: y, text: text, life: 0.7, color: color });
  }

  function bugScore(kind) {
    if (kind === "beetle") return 150;
    if (kind === "moth") return 250;
    if (kind === "roach") return 400;
    return 100;
  }

  function eatBug(b, index) {
    if (chainT > 0) chain += 1;
    else chain = 1;
    chainT = 1.35;
    var pts = Math.round(bugScore(b.kind) * chain * (1 + heat * 0.5));
    score += pts;
    player.chomp = 0.16;
    burst(b.x, b.y, b.kind === "moth" ? "#f4f4f2" : "#8dcc45", 8);
    floater(b.x, b.y - 8, "+" + pts + (chain > 1 ? " x" + chain : ""), "#f4f4f2");
    bugs.splice(index, 1);
    tone(320 + chain * 40, 0.06, "square", 0.04, 540 + chain * 30);
    noise(0.05, 0.03);
    saveBest();
  }

  function hurt(srcx, srcy) {
    if (invuln > 0 || mode !== "play") return;
    lives -= 1;
    invuln = 1.45;
    shake = 0.35;
    chain = 0;
    chainT = 0;
    var dx = player.x - srcx;
    var dy = player.y - srcy;
    var d = Math.hypot(dx, dy) || 1;
    var nx = player.x + dx / d * 26;
    var ny = player.y + dy / d * 26;
    if (!hitsSolid(nx, player.y, player.r)) player.x = nx;
    if (!hitsSolid(player.x, ny, player.r)) player.y = ny;
    burst(player.x, player.y, "#e23b2f", 10);
    tone(160, 0.16, "sawtooth", 0.05, 70);
    if (lives <= 0) {
      mode = "dead";
      saveBest();
      jingleDead();
    }
  }

  function scare(ent) {
    if (Math.hypot(ent.x - player.x, ent.y - player.y) <= FLARE_RADIUS) ent.fear = FEAR_TIME;
  }

  function scareSnake(s) {
    var pts = snakePoints(s);
    for (var i = 0; i < pts.length; i++) {
      if (Math.hypot(pts[i].x - player.x, pts[i].y - player.y) <= FLARE_RADIUS) {
        s.fear = FEAR_TIME;
        return;
      }
    }
  }

  function tryFlare() {
    if (mode !== "play" || intro > 0 || flareCd > 0) return;
    flare = FLARE_TIME;
    flareCd = FLARE_CD;
    snakes.forEach(scareSnake);
    cats.forEach(scare);
    goannas.forEach(scare);
    hawks.forEach(function (h) {
      if (Math.hypot(h.x - player.x, h.y - player.y) <= FLARE_RADIUS + 10) {
        h.fear = FEAR_TIME;
        h.state = "recover";
        h.timer = 0.85;
      }
    });
    burst(player.x, player.y, "#e23b2f", 14);
    noise(0.12, 0.05);
    tone(140, 0.12, "sawtooth", 0.04, 80);
  }

  function wishDir() {
    var x = 0;
    var y = 0;
    if (keys.arrowleft || keys.a) x -= 1;
    if (keys.arrowright || keys.d) x += 1;
    if (keys.arrowup || keys.w) y -= 1;
    if (keys.arrowdown || keys.s) y += 1;
    x += stick.dx;
    y += stick.dy;
    var m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x: x, y: y };
  }

  function updatePlayer(dt) {
    var d = wishDir();
    player.moving = Math.hypot(d.x, d.y) > 0.08;
    if (player.moving) {
      player.a = Math.atan2(d.y, d.x);
      moveBody(player, d.x * PLAYER_SPEED, d.y * PLAYER_SPEED, dt);
      if (Math.random() < dt * 10) {
        particles.push({
          x: player.x, y: player.y + 4, vx: (Math.random() - 0.5) * 12, vy: 8,
          life: 0.25, color: "rgba(90,60,30,.45)", s: 2
        });
      }
    }
    if (player.chomp > 0) player.chomp -= dt;
  }

  function updateBug(b, dt) {
    b.age += dt;
    if (b.age > b.turn) {
      b.turn = b.age + 0.4 + Math.random() * 0.7;
      b.ang = Math.random() * Math.PI * 2;
    }
    var awayx = b.x - player.x;
    var awayy = b.y - player.y;
    var ad = Math.hypot(awayx, awayy) || 1;
    var flee = ad < 46 ? (1 - ad / 46) : 0;
    var sp;
    var max;
    var wx;
    var wy;
    if (b.kind === "cricket") {
      b.hopping = (b.age % 1.15) < 0.14;
      sp = b.hopping ? 60 : 14;
      max = 60;
      wx = Math.cos(b.ang) * sp;
      wy = Math.sin(b.ang) * sp;
    } else if (b.kind === "beetle") {
      b.hopping = false;
      sp = 32;
      max = 46;
      wx = Math.cos(b.ang) * sp;
      wy = Math.sin(b.ang) * sp;
    } else if (b.kind === "moth") {
      b.hopping = true;
      sp = 42;
      max = 96;
      wx = Math.cos(b.ang) * sp + Math.cos(time * 6 + b.phase) * 36;
      wy = Math.sin(b.ang) * sp + Math.sin(time * 5.2 + b.phase) * 36;
    } else {
      b.hopping = (b.age % 0.95) < 0.2;
      sp = b.hopping ? 150 : 22;
      max = 150;
      wx = Math.cos(b.ang) * sp;
      wy = Math.sin(b.ang) * sp;
    }
    var sm = 1 + heat * 0.08;
    wx += awayx / ad * flee * 70;
    wy += awayy / ad * flee * 70;
    var v = clampSpeed(wx, wy, max * sm);
    var ox = b.x;
    var oy = b.y;
    moveBody(b, v.x, v.y, dt);
    if (Math.hypot(b.x - ox, b.y - oy) < 8 * dt) b.ang += 1.8;
  }

  function pushTrail(s) {
    var last = s.trail[s.trail.length - 1];
    if (!last || Math.hypot(s.x - last.x, s.y - last.y) >= 2) s.trail.push({ x: s.x, y: s.y });
    while (s.trail.length > 2 && polyLength(s.trail) > s.segs * s.spacing) s.trail.shift();
  }

  function updateSnake(s, dt) {
    if (s.fear > 0) s.fear -= dt;
    var target = s.path[s.i];
    var dx = target.x - s.x;
    var dy = target.y - s.y;
    var dist = Math.hypot(dx, dy);
    var step = s.speed * speedMul() * (s.fear > 0 ? 0.35 : 1) * dt;
    if (dist <= step || dist < 0.001) {
      s.x = target.x;
      s.y = target.y;
      s.i = (s.i + 1) % s.path.length;
    } else {
      s.x += dx / dist * step;
      s.y += dy / dist * step;
    }
    pushTrail(s);
  }

  function pickWander(ent) {
    for (var n = 0; n < 12; n++) {
      var tx = 1 + Math.floor(Math.random() * (COLS - 2));
      var ty = 1 + Math.floor(Math.random() * (ROWS - 2));
      if (solidAt(tx, ty)) continue;
      var c = tileCenter(tx, ty);
      ent.tx = c.x;
      ent.ty = c.y;
      ent.hasTarget = true;
      return;
    }
  }

  function updateCat(c, dt) {
    if (c.fear > 0) {
      c.fear -= dt;
      c.state = "wander";
      var dx = c.x - player.x;
      var dy = c.y - player.y;
      var d = Math.hypot(dx, dy) || 1;
      steer(c, c.x + dx / d * 48, c.y + dy / d * 48, 120 * speedMul(), dt);
      c.a = Math.atan2(dy, dx);
      return;
    }
    var pdx = player.x - c.x;
    var pdy = player.y - c.y;
    var pd = Math.hypot(pdx, pdy);
    if (c.state === "wander") {
      if (!c.hasTarget || Math.hypot(c.tx - c.x, c.ty - c.y) < 8) pickWander(c);
      steer(c, c.tx, c.ty, 50 * speedMul(), dt);
      c.a = Math.atan2(c.ty - c.y, c.tx - c.x);
      if (pd < 148 && los(c.x, c.y, player.x, player.y)) {
        c.state = "alert";
        c.timer = 0.5;
        c.lockX = player.x;
        c.lockY = player.y;
      }
    } else if (c.state === "alert") {
      c.timer -= dt;
      c.a = Math.atan2(player.y - c.y, player.x - c.x);
      if (c.timer <= 0) {
        var lx = c.lockX - c.x;
        var ly = c.lockY - c.y;
        var ld = Math.hypot(lx, ly) || 1;
        c.vx = lx / ld * 230 * speedMul();
        c.vy = ly / ld * 230 * speedMul();
        c.state = "pounce";
        c.timer = 0.32;
        tone(520, 0.05, "square", 0.03, 220);
      }
    } else if (c.state === "pounce") {
      c.timer -= dt;
      c.a = Math.atan2(c.vy, c.vx);
      moveBody(c, c.vx, c.vy, dt);
      if (c.timer <= 0) { c.state = "recover"; c.timer = 0.7; }
    } else if (c.state === "recover") {
      c.timer -= dt;
      if (c.timer <= 0) { c.state = "wander"; c.hasTarget = false; }
    }
    if (c.state !== "recover" && pd < c.r + player.r) hurt(c.x, c.y);
  }

  function updateGoanna(g, dt) {
    g.wanderT -= dt;
    if (g.fear > 0) {
      g.fear -= dt;
      var dx = g.x - player.x;
      var dy = g.y - player.y;
      var d = Math.hypot(dx, dy) || 1;
      steer(g, g.x + dx / d * 40, g.y + dy / d * 40, 100 * speedMul(), dt);
      g.a = Math.atan2(dy, dx);
      return;
    }
    var see = los(g.x, g.y, player.x, player.y) && Math.hypot(player.x - g.x, player.y - g.y) < 230;
    if (see) {
      steer(g, player.x, player.y, 72 * speedMul(), dt);
      g.a = Math.atan2(player.y - g.y, player.x - g.x);
    } else {
      if (!g.hasTarget || g.wanderT <= 0 || Math.hypot(g.tx - g.x, g.ty - g.y) < 8) {
        pickWander(g);
        g.wanderT = 1.4;
      }
      steer(g, g.tx, g.ty, 42 * speedMul(), dt);
      g.a = Math.atan2(g.ty - g.y, g.tx - g.x);
    }
    if (Math.hypot(player.x - g.x, player.y - g.y) < g.r + player.r) hurt(g.x, g.y);
  }

  function updateHawk(h, dt) {
    if (h.fear > 0) h.fear -= dt;
    if (h.state === "idle") {
      h.timer -= dt;
      h.x += (h.homeX - h.x) * Math.min(1, dt * 3);
      h.y += (h.homeY - h.y) * Math.min(1, dt * 3);
      if (h.timer <= 0) { h.state = "track"; h.timer = 0.82; }
    } else if (h.state === "track") {
      h.timer -= dt;
      var dx = player.x - h.x;
      var dy = player.y - h.y;
      var d = Math.hypot(dx, dy) || 1;
      var step = Math.min(d, 96 * speedMul() * dt);
      h.x += dx / d * step;
      h.y += dy / d * step;
      if (h.timer <= 0) { h.state = "lock"; h.timer = 0.48; tone(880, 0.04, "square", 0.025); }
    } else if (h.state === "lock") {
      h.timer -= dt;
      if (h.timer <= 0) { h.state = "strike"; h.timer = 0.16; }
    } else if (h.state === "strike") {
      h.timer -= dt;
      if (Math.hypot(player.x - h.x, player.y - h.y) < h.r + player.r - 4) hurt(h.x, h.y);
      if (h.timer <= 0) { h.state = "recover"; h.timer = 0.7; }
    } else {
      h.timer -= dt;
      if (h.timer <= 0) { h.state = "idle"; h.timer = 1.15; }
    }
  }

  function snakePoints(s) {
    var pts = [];
    if (!s.trail.length) return [{ x: s.x, y: s.y }];
    pts.push(s.trail[s.trail.length - 1]);
    var acc = 0;
    for (var i = s.trail.length - 1; i > 0; i--) {
      var a = s.trail[i];
      var b = s.trail[i - 1];
      var seg = Math.hypot(a.x - b.x, a.y - b.y);
      acc += seg;
      if (acc >= s.spacing) {
        pts.push(b);
        acc = 0;
      }
    }
    return pts;
  }

  function updateFx(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (var j = floaters.length - 1; j >= 0; j--) {
      floaters[j].y -= 22 * dt;
      floaters[j].life -= dt;
      if (floaters[j].life <= 0) floaters.splice(j, 1);
    }
  }

  function update(dt) {
    time += dt;
    if (shake > 0) shake = Math.max(0, shake - dt);
    if (mode !== "title") updateFx(dt);
    if (mode !== "play") return;

    if (intro > 0) intro -= dt;
    if (invuln > 0) invuln -= dt;
    if (flare > 0) flare -= dt;
    if (flareCd > 0) flareCd = Math.max(0, flareCd - dt);
    if (chainT > 0) {
      chainT -= dt;
      if (chainT <= 0) chain = 0;
    }

    updatePlayer(dt);
    for (var i = bugs.length - 1; i >= 0; i--) {
      updateBug(bugs[i], dt);
      if (Math.hypot(bugs[i].x - player.x, bugs[i].y - player.y) < 22) eatBug(bugs[i], i);
    }
    snakes.forEach(function (s) { updateSnake(s, dt); });
    cats.forEach(function (c) { updateCat(c, dt); });
    goannas.forEach(function (g) { updateGoanna(g, dt); });
    hawks.forEach(function (h) { updateHawk(h, dt); });

    if (mode !== "play") return;
    snakes.forEach(function (s) {
      if (s.fear > 0) return;
      var pts = snakePoints(s);
      for (var k = 0; k < pts.length; k++) {
        if (Math.hypot(pts[k].x - player.x, pts[k].y - player.y) < s.r + player.r) {
          hurt(pts[k].x, pts[k].y);
          return;
        }
      }
    });

    if (mode === "play" && bugs.length === 0) {
      score += Math.round(500 * (1 + heat * 0.5));
      saveBest();
      mode = "clear";
      clearT = 1.7;
      jingleClear();
      burst(player.x, player.y, "#e8bf4a", 18);
    }
  }

  function updateClear(dt) {
    if (mode !== "clear") return;
    clearT -= dt;
    if (clearT <= 0) advance();
  }

  function roundRect(x, y, w, h, r) {
    var rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function label(str, x, y, size, color, align) {
    ctx.fillStyle = color;
    ctx.font = "700 " + size + "px Trebuchet MS, Segoe UI, sans-serif";
    ctx.textAlign = align || "left";
    ctx.textBaseline = "middle";
    ctx.fillText(str, x, y);
  }

  function drawHeart(x, y, filled) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(0.72, 0.72);
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.bezierCurveTo(-8, -4, -3, -9, 0, -4);
    ctx.bezierCurveTo(3, -9, 8, -4, 0, 3);
    ctx.fillStyle = filled ? "#e23b2f" : "#3a2a28";
    ctx.fill();
    ctx.restore();
  }

  function drawSand() {
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var n = (x * 13 + y * 7) % 3;
        ctx.fillStyle = theme.sand[n];
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        if (((x * 5 + y * 3) % 7) === 0) {
          ctx.fillStyle = "rgba(80,50,20,.18)";
          ctx.fillRect(x * TILE + 6, y * TILE + 14, 2, 2);
          ctx.fillRect(x * TILE + 16, y * TILE + 7, 2, 2);
        }
      }
    }
  }

  function drawRocks() {
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var ch = tiles[y][x];
        if (ch !== "#" && ch !== "*") continue;
        var px = x * TILE;
        var py = y * TILE;
        if (ch === "#") {
          ctx.fillStyle = theme.rock;
          roundRect(px + 1, py + 2, TILE - 2, TILE - 3, 4);
          ctx.fill();
          ctx.fillStyle = theme.rockHi;
          roundRect(px + 4, py + 4, TILE - 10, 6, 3);
          ctx.fill();
        } else {
          ctx.fillStyle = theme.bush;
          ctx.beginPath();
          ctx.arc(px + 8, py + 14, 6, 0, Math.PI * 2);
          ctx.arc(px + 16, py + 13, 7, 0, Math.PI * 2);
          ctx.arc(px + 12, py + 8, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = theme.bushHi;
          ctx.beginPath();
          ctx.arc(px + 11, py + 8, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawLizard(x, y, angle, flareOn, hidden, moving) {
    if (hidden) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.beginPath();
    ctx.ellipse(0, 6, 12, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a85a28";
    ctx.beginPath();
    ctx.moveTo(-4, -3);
    ctx.quadraticCurveTo(-16, -1, -20, 2);
    ctx.quadraticCurveTo(-14, 5, -4, 3.2);
    ctx.fill();
    ctx.fillStyle = "#e2b84a";
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-8 - i * 3.2, -1.5);
      ctx.lineTo(-9 - i * 3.2, -6);
      ctx.lineTo(-6 - i * 3.2, -1.2);
      ctx.fill();
    }
    var swing = moving ? Math.sin(time * 16) : 0;
    ctx.fillStyle = "#b86a30";
    ctx.beginPath();
    ctx.ellipse(-2, 5 + swing, 3.2, 2.1, 0.4, 0, Math.PI * 2);
    ctx.ellipse(-2, -5 - swing, 3.2, 2.1, -0.4, 0, Math.PI * 2);
    ctx.ellipse(6, 5 - swing, 3, 2, 0.2, 0, Math.PI * 2);
    ctx.ellipse(6, -5 + swing, 3, 2, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d4843a";
    ctx.beginPath();
    ctx.ellipse(1, 0, 10, 6.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f0d2a6";
    ctx.beginPath();
    ctx.ellipse(2, 1.4, 5.2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f0c85a";
    for (var s = 0; s < 4; s++) {
      ctx.beginPath();
      ctx.moveTo(-4 + s * 3, -5);
      ctx.lineTo(-2.6 + s * 3, -9.5);
      ctx.lineTo(-1 + s * 3, -5);
      ctx.fill();
    }
    ctx.fillStyle = "#c67232";
    ctx.beginPath();
    ctx.ellipse(11, 0, 5.6, 4.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff6e8";
    ctx.beginPath();
    ctx.arc(13, -1.3, 1.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a120c";
    ctx.beginPath();
    ctx.arc(13.5, -1.3, 0.7, 0, Math.PI * 2);
    ctx.fill();
    var ext = flareOn ? 10 : 4;
    ctx.fillStyle = flareOn ? "#e23b2f" : "#2c241c";
    ctx.beginPath();
    ctx.moveTo(8, 2.4);
    ctx.lineTo(15, ext);
    ctx.lineTo(6.5, 4.6);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, -2.4);
    ctx.lineTo(15, -ext);
    ctx.lineTo(6.5, -4.6);
    ctx.fill();
    if (player && player.chomp > 0 && !hidden) {
      ctx.fillStyle = "#6a2030";
      ctx.beginPath();
      ctx.arc(15.5, 1.2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBug(b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    var squash = b.hopping ? 0.75 : 1;
    ctx.scale(1, squash);
    if (b.kind === "cricket") {
      ctx.strokeStyle = "#3d6b22";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-3, 2);
      ctx.lineTo(-8, 6);
      ctx.moveTo(3, 2);
      ctx.lineTo(8, 6);
      ctx.moveTo(-1, -2);
      ctx.lineTo(-4, -7);
      ctx.stroke();
      ctx.fillStyle = "#7dba3a";
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === "beetle") {
      ctx.fillStyle = "#3c2a55";
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.2, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c9b6ea";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.lineTo(0, 3);
      ctx.stroke();
    } else if (b.kind === "moth") {
      ctx.fillStyle = "rgba(244,244,242,.95)";
      ctx.strokeStyle = "rgba(20,16,10,.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(-3, 0, 5, 3.2, -0.4, 0, Math.PI * 2);
      ctx.ellipse(3, 0, 5, 3.2, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#6a4a28";
      ctx.fillRect(-1, -2.2, 2, 5.2);
    } else {
      ctx.strokeStyle = "#5a3a22";
      ctx.beginPath();
      ctx.moveTo(-2, -1);
      ctx.lineTo(-7, -5);
      ctx.moveTo(2, -1);
      ctx.lineTo(7, -5);
      ctx.stroke();
      ctx.fillStyle = "#8a5a32";
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 3.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSnake(s) {
    var pts = snakePoints(s);
    var feared = s.fear > 0;
    for (var i = pts.length - 1; i >= 0; i--) {
      var p = pts[i];
      var head = i === 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, head ? s.r + 1.2 : s.r - 0.4, 0, Math.PI * 2);
      ctx.fillStyle = feared ? "#7f93b0" : (head ? "#2f6a3e" : (i % 2 ? "#3f8a4e" : "#2c5c38"));
      ctx.fill();
      if (head) {
        ctx.fillStyle = "#f4f4f2";
        ctx.beginPath();
        ctx.arc(p.x + 2, p.y - 2, 1.3, 0, Math.PI * 2);
        ctx.arc(p.x - 2, p.y - 2, 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1a120c";
        ctx.beginPath();
        ctx.arc(p.x + 2.2, p.y - 2, 0.6, 0, Math.PI * 2);
        ctx.arc(p.x - 1.8, p.y - 2, 0.6, 0, Math.PI * 2);
        ctx.fill();
        if (Math.floor(time * 6) % 2 === 0) {
          ctx.strokeStyle = "#e23b2f";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y + 2);
          ctx.lineTo(p.x + 4, p.y + 6);
          ctx.stroke();
        }
      }
    }
  }

  function drawCat(c) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.a);
    var feared = c.fear > 0;
    var body = feared ? "#8aa4c4" : "#e07a32";
    if (c.state === "alert") ctx.scale(1.05, 0.82);
    if (c.state === "pounce") ctx.scale(1.25, 0.8);
    ctx.fillStyle = "rgba(0,0,0,.2)";
    ctx.beginPath();
    ctx.ellipse(0, 5, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = feared ? "#d5e2f2" : "#f2c9a0";
    ctx.beginPath();
    ctx.ellipse(1, 1, 4, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(6, -3);
    ctx.lineTo(9, -8);
    ctx.lineTo(11, -2);
    ctx.moveTo(10, -2);
    ctx.lineTo(14, -7);
    ctx.lineTo(14, -1);
    ctx.fill();
    ctx.fillStyle = "#1a120c";
    ctx.fillRect(8, -1.2, 1.4, 1.4);
    ctx.strokeStyle = body;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.quadraticCurveTo(-14, -6, -12, -2);
    ctx.stroke();
    ctx.restore();
    if (c.state === "alert") {
      label("!", c.x, c.y - 16, 14, "#e8bf4a", "center");
    }
  }

  function drawGoanna(g) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.a);
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.beginPath();
    ctx.ellipse(0, 5, 12, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    var body = g.fear > 0 ? "#8aa4c4" : "#d2e06a";
    ctx.fillStyle = "#243028";
    ctx.beginPath();
    ctx.ellipse(-8, 0, 9, 3.6, 0, 0, Math.PI * 2);
    ctx.ellipse(5, 0, 11, 5.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(-7, 0, 7, 2.4, 0, 0, Math.PI * 2);
    ctx.ellipse(5, 0, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#243028";
    for (var i = 0; i < 4; i++) {
      ctx.fillRect(-4 + i * 4, -1.2, 1.4, 2.4);
    }
    ctx.fillStyle = "#1a120c";
    ctx.beginPath();
    ctx.arc(12, -1.4, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4f4f2";
    ctx.beginPath();
    ctx.arc(12.4, -1.6, 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHawk(h) {
    var rad = h.state === "lock" ? 13 + Math.sin(time * 24) * 2.2 : h.state === "strike" ? 12 : 18;
    ctx.fillStyle = "rgba(255,244,220,.28)";
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, rad + 7, (rad + 7) * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(10,8,16," + (h.state === "idle" ? 0.38 : 0.7) + ")";
    ctx.beginPath();
    ctx.ellipse(h.x, h.y + 2, rad, rad * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = h.state === "lock" ? "#e23b2f" : "rgba(255,248,230,.95)";
    ctx.lineWidth = h.state === "lock" ? 3 : 2;
    ctx.stroke();
    if (h.state === "strike") {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.fillStyle = "#5a4638";
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(0, -5);
      ctx.lineTo(18, 0);
      ctx.lineTo(0, 5);
      ctx.fill();
      ctx.fillStyle = "#f4f4f2";
      ctx.beginPath();
      ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8bf4a";
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.lineTo(-2, 8);
      ctx.lineTo(2, 8);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(h.x, h.y - rad - 7);
      ctx.fillStyle = "#d9c4a4";
      ctx.beginPath();
      ctx.moveTo(-9, 2);
      ctx.lineTo(0, -3);
      ctx.lineTo(9, 2);
      ctx.lineTo(0, 0);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawWorld() {
    drawSand();
    drawRocks();
    hawks.forEach(drawHawk);
    bugs.forEach(drawBug);
    snakes.forEach(drawSnake);
    goannas.forEach(drawGoanna);
    cats.forEach(drawCat);
    var hidden = invuln > 0 && Math.floor(time * 14) % 2 === 0;
    drawLizard(player.x, player.y, player.a, flare > 0, hidden, player.moving);
    if (flare > 0) {
      var k = 1 - flare / FLARE_TIME;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 12 + k * FLARE_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(226,59,47," + (1 - k) * 0.85 + ")";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.s, p.s);
      ctx.globalAlpha = 1;
    });
    floaters.forEach(function (f) {
      ctx.globalAlpha = Math.max(0, f.life);
      label(f.text, f.x, f.y, 12, f.color, "center");
      ctx.globalAlpha = 1;
    });
  }

  function drawHud() {
    ctx.fillStyle = "#1a120c";
    ctx.fillRect(0, 0, W, HUD);
    ctx.fillStyle = "#e8bf4a";
    ctx.fillRect(0, HUD - 2, W, 2);
    var hearts = Math.max(3, lives);
    for (var i = 0; i < hearts; i++) drawHeart(16 + i * 16, 20, lives > i);
    var bugText = "BUGS " + (totalBugs - bugs.length) + "/" + totalBugs;
    if (chain > 1) bugText += "  x" + chain;
    label(bugText, 16 + hearts * 16 + 6, 20, 13, "#f4f4f2", "left");
    var name = levelName + (heat > 0 ? "   HEAT " + heat : "");
    label(name, W / 2, 20, 14, "#e8bf4a", "center");
    var meterW = 62;
    var meterX = W - 118;
    label("BEARD", meterX - 48, 20, 10, "#f0d2a6", "left");
    ctx.fillStyle = "#2a2118";
    roundRect(meterX, 14, meterW, 12, 4);
    ctx.fill();
    var ready = flareCd <= 0 ? 1 : 1 - flareCd / FLARE_CD;
    ctx.fillStyle = flareCd <= 0 ? "#e23b2f" : "#8a4e38";
    roundRect(meterX, 14, Math.max(0, meterW * ready), 12, 4);
    ctx.fill();
    label(String(score), W - 10, 20, 15, "#f4f4f2", "right");
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = "rgba(16,10,6,.78)";
    roundRect(x, y, w, h, 14);
    ctx.fill();
  }

  function drawOverlay() {
    if (mode === "play" && intro > 0) {
      panel(W / 2 - 210, HUD + 16, 420, 46);
      label(levelName, W / 2, HUD + 30, 14, "#e8bf4a", "center");
      label(levelTip, W / 2, HUD + 48, 12, "#f4f4f2", "center");
    }
    if (mode === "pause") {
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(0, HUD, W, H);
      panel(W / 2 - 150, VIEW_H / 2 - 46, 300, 92);
      label("PAUSED", W / 2, VIEW_H / 2 - 16, 22, "#e8bf4a", "center");
      label("ENTER TO RESUME", W / 2, VIEW_H / 2 + 14, 13, "#f4f4f2", "center");
    }
    if (mode === "clear") {
      panel(W / 2 - 170, VIEW_H / 2 - 48, 340, 96);
      label("LEVEL CLEAR", W / 2, VIEW_H / 2 - 18, 22, "#e8bf4a", "center");
      var next = levelIndex + 1 >= LEVELS.length ? "THE WHOLE YARD" : LEVELS[levelIndex + 1].name;
      label("NEXT  " + next, W / 2, VIEW_H / 2 + 12, 13, "#f4f4f2", "center");
    }
    if (mode === "dead") {
      ctx.fillStyle = "rgba(0,0,0,.5)";
      ctx.fillRect(0, HUD, W, H);
      panel(W / 2 - 180, VIEW_H / 2 - 70, 360, 140);
      label("YOU GOT EATEN", W / 2, VIEW_H / 2 - 40, 22, "#e23b2f", "center");
      label("SCORE " + score + "    BEST " + best, W / 2, VIEW_H / 2 - 8, 14, "#f4f4f2", "center");
      label("ENTER TO TRY AGAIN", W / 2, VIEW_H / 2 + 28, 13, "#e8bf4a", "center");
    }
    if (mode === "won") {
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(0, HUD, W, H);
      panel(W / 2 - 200, VIEW_H / 2 - 78, 400, 156);
      label("YARD CLEARED", W / 2, VIEW_H / 2 - 46, 22, "#e8bf4a", "center");
      label("Every bug is gone.", W / 2, VIEW_H / 2 - 16, 14, "#f4f4f2", "center");
      label("SCORE " + score + "    BEST " + best, W / 2, VIEW_H / 2 + 10, 14, "#f4f4f2", "center");
      label("ENTER FOR A HOTTER DAY", W / 2, VIEW_H / 2 + 42, 13, "#e23b2f", "center");
    }
  }

  function renderTitle() {
    var g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, "#f3ddb0");
    g.addColorStop(1, "#c9954c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, VIEW_H);
    ctx.fillStyle = "#6e5844";
    roundRect(40, 250, 70, 28, 8);
    ctx.fill();
    roundRect(430, 230, 90, 34, 8);
    ctx.fill();
    ctx.fillStyle = "#3f7a3a";
    ctx.beginPath();
    ctx.arc(500, 250, 16, 0, Math.PI * 2);
    ctx.arc(524, 246, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(196, 198);
    ctx.scale(2.2, 2.2);
    drawLizard(0, 0, Math.sin(time * 1.4) * 0.18, Math.sin(time * 3) > 0, false, true);
    ctx.restore();
    ctx.save();
    ctx.translate(292, 168 + Math.sin(time * 6) * 6);
    drawBug({ x: 0, y: 0, kind: "cricket", hopping: true });
    ctx.restore();
    panel(48, 28, W - 96, 78);
    label("BEARD LIZARD", W / 2, 50, 30, "#e8bf4a", "center");
    label("EAT EVERY BUG.   DON'T GET EATEN.", W / 2, 82, 13, "#f4f4f2", "center");
    panel(58, 286, W - 116, 72);
    label("ARROWS OR WASD TO MOVE", W / 2, 306, 13, "#f4f4f2", "center");
    label("SPACE FLARES YOUR BEARD AND SCARES THEM", W / 2, 326, 12, "#f0d2a6", "center");
    if (Math.floor(time * 2) % 2 === 0) label("PRESS ENTER", W / 2, 346, 13, "#e8bf4a", "center");
    if (best > 0) label("BEST " + best, W - 18, 18, 12, "#1a120c", "right");
  }

  function render() {
    ctx.setTransform(viewScale * dpr, 0, 0, viewScale * dpr, 0, 0);
    ctx.clearRect(0, 0, W, VIEW_H);
    if (mode === "title") {
      renderTitle();
      return;
    }
    ctx.fillStyle = theme.sky;
    ctx.fillRect(0, 0, W, VIEW_H);
    ctx.save();
    var mag = shake * 10;
    ctx.translate((Math.random() - 0.5) * mag, HUD + (Math.random() - 0.5) * mag);
    drawWorld();
    ctx.restore();
    drawHud();
    drawOverlay();
  }

  function frame(ts) {
    if (!lastTs) lastTs = ts;
    var dt = Math.min(0.032, (ts - lastTs) / 1000);
    lastTs = ts;
    if (!document.hidden) {
      update(dt);
      updateClear(dt);
      render();
    }
    requestAnimationFrame(frame);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewScale = Math.min(window.innerWidth / W, window.innerHeight / VIEW_H);
    if (!isFinite(viewScale) || viewScale <= 0) viewScale = 1;
    canvas.style.width = Math.floor(W * viewScale) + "px";
    canvas.style.height = Math.floor(VIEW_H * viewScale) + "px";
    canvas.width = Math.max(1, Math.floor(W * viewScale * dpr));
    canvas.height = Math.max(1, Math.floor(VIEW_H * viewScale * dpr));
  }

  function onAction(key) {
    try { audio(); } catch (e) {}
    if (key === "m") { muted = !muted; return; }
    if (key === "p" || key === "escape") {
      if (mode === "play") mode = "pause";
      else if (mode === "pause") mode = "play";
      return;
    }
    if (key === "f") {
      var root = document.documentElement;
      if (!document.fullscreenElement && root.requestFullscreen) root.requestFullscreen();
      else if (document.exitFullscreen) document.exitFullscreen();
      return;
    }
    if (key === "enter") {
      if (mode === "title" || mode === "dead") startGame(false);
      else if (mode === "won") startHeat();
      else if (mode === "clear") advance();
      else if (mode === "pause") mode = "play";
      return;
    }
    if (key === " " || key === "spacebar") {
      if (mode === "title" || mode === "dead") startGame(false);
      else if (mode === "won") startHeat();
      else if (mode === "play") tryFlare();
    }
  }

  window.addEventListener("keydown", function (e) {
    var key = e.key.toLowerCase();
    if (key === "space") key = " ";
    if (key === "arrowup" || key === "arrowdown" || key === "arrowleft" || key === "arrowright" || key === " ") e.preventDefault();
    var first = !keys[key];
    keys[key] = true;
    if (first) onAction(key);
  });
  window.addEventListener("keyup", function (e) {
    var key = e.key.toLowerCase();
    if (key === "space") key = " ";
    keys[key] = false;
  });
  window.addEventListener("blur", function () {
    keys = {};
    stick.dx = 0;
    stick.dy = 0;
  });
  window.addEventListener("resize", resize);
  canvas.addEventListener("pointerdown", function () {
    try { audio(); } catch (e) {}
    if (mode === "title" || mode === "dead") startGame(false);
    else if (mode === "won") startHeat();
    else if (mode === "clear") advance();
    else if (mode === "pause") mode = "play";
  });

  var stickEl = document.getElementById("stick");
  var nub = document.getElementById("nub");
  var flareBtn = document.getElementById("flare");

  function moveStick(e) {
    var rect = stickEl.getBoundingClientRect();
    var dx = e.clientX - (rect.left + rect.width / 2);
    var dy = e.clientY - (rect.top + rect.height / 2);
    var max = rect.width * 0.36;
    var m = Math.hypot(dx, dy) || 1;
    var cl = Math.min(m, max);
    nub.style.transform = "translate(" + (dx / m * cl) + "px," + (dy / m * cl) + "px)";
    stick.dx = (dx / m * cl) / max;
    stick.dy = (dy / m * cl) / max;
  }
  stickEl.addEventListener("pointerdown", function (e) {
    stick.id = e.pointerId;
    stickEl.setPointerCapture(e.pointerId);
    moveStick(e);
    e.preventDefault();
  });
  stickEl.addEventListener("pointermove", function (e) {
    if (e.pointerId !== stick.id) return;
    moveStick(e);
  });
  function endStick(e) {
    if (e.pointerId !== stick.id) return;
    stick.id = null;
    stick.dx = 0;
    stick.dy = 0;
    nub.style.transform = "translate(0px,0px)";
  }
  stickEl.addEventListener("pointerup", endStick);
  stickEl.addEventListener("pointercancel", endStick);

  flareBtn.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    try { audio(); } catch (err) {}
    if (mode === "title" || mode === "dead") startGame(false);
    else if (mode === "won") startHeat();
    else if (mode === "pause") mode = "play";
    else tryFlare();
  });

  function validateLevels() {
    var problems = [];
    LEVELS.forEach(function (L) {
      if (L.rows.length !== ROWS) problems.push(L.name + " row count");
      L.rows.forEach(function (row, i) {
        if (row.length !== COLS) problems.push(L.name + " row " + i + " width " + row.length);
      });
      var start = null;
      var seen = {};
      for (var y = 0; y < L.rows.length; y++) {
        for (var x = 0; x < L.rows[y].length; x++) {
          if (L.rows[y][x] === "S") start = [x, y];
        }
      }
      if (!start) { problems.push(L.name + " missing start"); return; }
      var stack = [start];
      var solid = { "#": 1, "*": 1 };
      while (stack.length) {
        var p = stack.pop();
        var k = p[0] + "," + p[1];
        if (seen[k]) continue;
        if (solid[L.rows[p[1]][p[0]]]) continue;
        seen[k] = 1;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var nx = p[0] + d[0];
          var ny = p[1] + d[1];
          if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS) stack.push([nx, ny]);
        });
      }
      var bugsN = 0;
      for (var yy = 0; yy < ROWS; yy++) {
        for (var xx = 0; xx < COLS; xx++) {
          var ch = L.rows[yy][xx];
          if ("cbmrKHG".indexOf(ch) >= 0 && !seen[xx + "," + yy]) problems.push(L.name + " unreachable " + ch + " @" + xx + "," + yy);
          if ("cbmr".indexOf(ch) >= 0) bugsN += 1;
        }
      }
      if (!bugsN) problems.push(L.name + " has no bugs");
      L.snakes.forEach(function (s) {
        for (var i = 0; i < s.path.length; i++) {
          var a = s.path[i];
          var b = s.path[(i + 1) % s.path.length];
          if (a[0] !== b[0] && a[1] !== b[1]) problems.push(L.name + " diagonal snake");
          var x0 = Math.min(a[0], b[0]);
          var x1 = Math.max(a[0], b[0]);
          var y0 = Math.min(a[1], b[1]);
          var y1 = Math.max(a[1], b[1]);
          for (var x = x0; x <= x1; x++) {
            for (var y = y0; y <= y1; y++) {
              if (!L.rows[y] || solid[L.rows[y][x]] || !seen[x + "," + y]) problems.push(L.name + " snake wall " + x + "," + y);
            }
          }
        }
      });
    });
    return problems;
  }

  var levelProblems = validateLevels();
  if (levelProblems.length) console.error("Beard Lizard levels", levelProblems);

  window.__BEARD = {
    problems: levelProblems,
    validate: validateLevels,
    snapshot: function () {
      return {
        mode: mode,
        level: levelIndex,
        name: levelName,
        bugs: bugs.length,
        lives: lives,
        score: score,
        heat: heat,
        px: player ? Math.round(player.x) : 0,
        py: player ? Math.round(player.y) : 0,
        snakes: snakes.length,
        cats: cats.length,
        hawks: hawks.length,
        goannas: goannas.length,
        flareCd: flareCd,
        intro: intro,
        invuln: invuln,
        fear: snakes.length ? snakes[0].fear : 0,
        bx: bugs.length ? Math.round(bugs[0].x) : 0,
        by: bugs.length ? Math.round(bugs[0].y) : 0
      };
    },
    start: function () { startGame(false); },
    snapTo: function (x, y) {
      if (!player) return;
      player.x = x;
      player.y = y;
    },
    eatAll: function () { bugs.splice(0, bugs.length); },
    skipIntro: function () { intro = 0; invuln = 0; },
    placeOnSnake: function () {
      if (!snakes.length) return;
      player.x = snakes[0].x;
      player.y = snakes[0].y;
      intro = 0;
      invuln = 0;
    },
    flareNow: function () { intro = 0; flareCd = 0; tryFlare(); },
    setMuted: function (v) { muted = v; }
  };

  resize();
  requestAnimationFrame(frame);
})();
