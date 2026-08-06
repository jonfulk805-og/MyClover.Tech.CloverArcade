/* CloverArcade -- in-browser ROM and box-art uploader.
   Talks to the local upload service through nginx at /api/. Streams each file
   with XHR so a 4 GB ISO uploads with a real progress bar. */
(function () {
  "use strict";

  var TOKEN_KEY = "cloverarcade.token";
  var state = { enabled: false, systems: [], maxBytes: 0, busy: 0 };

  var el = {};

  function $(id) { return document.getElementById(id); }

  function token() { return window.localStorage.getItem(TOKEN_KEY) || ""; }
  function setToken(v) { window.localStorage.setItem(TOKEN_KEY, v || ""); }

  function human(bytes) {
    if (!bytes && bytes !== 0) return "--";
    var u = ["B", "KB", "MB", "GB", "TB"], i = 0, n = bytes;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i += 1; }
    return (n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)) + " " + u[i];
  }

  function build() {
    var wrap = document.createElement("div");
    wrap.className = "upload-modal";
    wrap.id = "upload-modal";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="upload-panel" role="dialog" aria-label="Add ROMs">' +
        '<div class="upload-head">' +
          '<h2>&#9650; LOAD CARTRIDGE</h2>' +
          '<button class="btn upload-close" id="upload-close">CLOSE</button>' +
        '</div>' +
        '<div class="upload-row">' +
          '<label for="upload-token">UPLOAD TOKEN</label>' +
          '<input id="upload-token" type="password" autocomplete="off" spellcheck="false" placeholder="paste UPLOAD_TOKEN">' +
        '</div>' +
        '<div class="upload-row upload-row-2">' +
          '<div><label for="upload-system">SYSTEM</label><select id="upload-system"></select></div>' +
          '<div><label for="upload-kind">TYPE</label><select id="upload-kind">' +
            '<option value="rom">ROM / disc image</option>' +
            '<option value="art">Box art (png/jpg/webp)</option>' +
          '</select></div>' +
        '</div>' +
        '<div class="dropzone" id="dropzone" tabindex="0">' +
          '<strong>DROP FILES HERE</strong>' +
          '<span>or click to browse &middot; zip is fine, no need to extract</span>' +
          '<input id="upload-input" type="file" multiple hidden>' +
        '</div>' +
        '<div class="upload-actions">' +
          '<button class="btn" id="upload-art" type="button">&#9670; AUTO-FETCH BOX ART</button>' +
          '<span class="upload-hint">pulls covers for the selected system from the libretro thumbnail archive</span>' +
        '</div>' +
        '<ul class="upload-queue" id="upload-queue"></ul>' +
        '<p class="upload-note" id="upload-note"></p>' +
      '</div>';
    document.body.appendChild(wrap);

    var btn = document.createElement("button");
    btn.className = "cabinet-btn upload-open";
    btn.id = "upload-open";
    btn.type = "button";
    btn.hidden = true;
    btn.innerHTML = "&#9650; ADD ROMS";
    var nav = document.querySelector(".controls");
    if (nav) nav.appendChild(btn);

    el = {
      modal: wrap, open: btn, close: $("upload-close"),
      token: $("upload-token"), system: $("upload-system"), kind: $("upload-kind"),
      zone: $("dropzone"), input: $("upload-input"),
      queue: $("upload-queue"), note: $("upload-note"), art: $("upload-art")
    };
  }

  function note(msg, bad) {
    el.note.textContent = msg || "";
    el.note.className = "upload-note" + (bad ? " bad" : "");
  }

  function fillSystems() {
    el.system.innerHTML = "";
    state.systems.forEach(function (s) {
      var o = document.createElement("option");
      o.value = s;
      o.textContent = s;
      el.system.appendChild(o);
    });
    el.system.value = "nes";
  }

  function status() {
    return fetch("api/status", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        state.systems = d.systems || [];
        state.maxBytes = d.max_bytes || 0;
        fillSystems();
        var free = d.free_bytes ? human(d.free_bytes) + " free on the ROM volume" : "";
        note("Max " + human(state.maxBytes) + " per file. " + free);
        return d;
      })
      .catch(function () { note("Upload service is not reachable.", true); });
  }

  function row(file) {
    var li = document.createElement("li");
    li.innerHTML =
      '<span class="q-name"></span>' +
      '<span class="q-bar"><i></i></span>' +
      '<span class="q-state">queued</span>';
    li.querySelector(".q-name").textContent = file.name + "  (" + human(file.size) + ")";
    el.queue.appendChild(li);
    return {
      bar: li.querySelector(".q-bar i"),
      label: li.querySelector(".q-state"),
      li: li
    };
  }

  function upload(file, system, kind) {
    var ui = row(file);
    return new Promise(function (resolve) {
      if (state.maxBytes && file.size > state.maxBytes) {
        ui.label.textContent = "too big";
        ui.li.classList.add("bad");
        return resolve(false);
      }
      var url = "api/upload?system=" + encodeURIComponent(system) +
                "&kind=" + encodeURIComponent(kind) +
                "&name=" + encodeURIComponent(file.name);
      var xhr = new XMLHttpRequest();
      xhr.open("PUT", url, true);
      xhr.setRequestHeader("X-Clover-Token", token());
      xhr.upload.onprogress = function (e) {
        if (!e.lengthComputable) return;
        var pct = Math.round((e.loaded / e.total) * 100);
        ui.bar.style.width = pct + "%";
        ui.label.textContent = pct + "%";
      };
      xhr.onload = function () {
        var ok = xhr.status >= 200 && xhr.status < 300;
        ui.bar.style.width = "100%";
        if (ok) {
          ui.label.textContent = "loaded";
          ui.li.classList.add("good");
        } else {
          var msg = "failed";
          try { msg = (JSON.parse(xhr.responseText).error || msg); } catch (err) { /* noop */ }
          ui.label.textContent = msg;
          ui.li.classList.add("bad");
          ui.li.title = msg;
        }
        resolve(ok);
      };
      xhr.onerror = function () {
        ui.label.textContent = "network error";
        ui.li.classList.add("bad");
        resolve(false);
      };
      xhr.send(file);
    });
  }

  function handle(files) {
    if (!files || !files.length) return;
    if (!token()) { note("Enter the upload token first.", true); return; }
    var system = el.system.value;
    var kind = el.kind.value;
    var list = Array.prototype.slice.call(files);
    var okCount = 0;
    state.busy += 1;
    note("Uploading " + list.length + " file(s) to roms/" + system + (kind === "art" ? "/boxart" : "") + " ...");

    // sequential: one big file at a time keeps the progress honest and the disk sane
    list.reduce(function (chain, file) {
      return chain.then(function () {
        return upload(file, system, kind).then(function (ok) { if (ok) okCount += 1; });
      });
    }, Promise.resolve()).then(function () {
      state.busy -= 1;
      note(okCount + " of " + list.length + " file(s) loaded. Cabinet refreshing...");
      window.setTimeout(function () {
        if (window.CloverArcade) window.CloverArcade.reload();
        status();
      }, 2500);
    });
  }

  function wire() {
    el.open.addEventListener("click", function () {
      el.modal.hidden = false;
      el.token.value = token();
      status();
    });
    el.close.addEventListener("click", function () { el.modal.hidden = true; });
    el.modal.addEventListener("click", function (e) {
      if (e.target === el.modal) el.modal.hidden = true;
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !el.modal.hidden) el.modal.hidden = true;
    });
    el.token.addEventListener("change", function () { setToken(el.token.value.trim()); });
    el.token.addEventListener("blur", function () { setToken(el.token.value.trim()); });

    el.zone.addEventListener("click", function () { el.input.click(); });
    el.zone.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.input.click(); }
    });
    el.input.addEventListener("change", function () {
      handle(el.input.files);
      el.input.value = "";
    });
    ["dragenter", "dragover"].forEach(function (evt) {
      el.zone.addEventListener(evt, function (e) {
        e.preventDefault();
        el.zone.classList.add("hot");
      });
    });
    ["dragleave", "drop"].forEach(function (evt) {
      el.zone.addEventListener(evt, function (e) {
        e.preventDefault();
        el.zone.classList.remove("hot");
      });
    });
    el.zone.addEventListener("drop", function (e) {
      if (e.dataTransfer && e.dataTransfer.files) handle(e.dataTransfer.files);
    });
    el.art.addEventListener("click", function () {
      if (!token()) { note("Enter the upload token first.", true); return; }
      var system = el.system.value;
      el.art.disabled = true;
      note("Looking for covers for roms/" + system + " ...");
      fetch("api/boxart?system=" + encodeURIComponent(system), {
        method: "POST",
        headers: { "X-Clover-Token": token() }
      }).then(function (r) { return r.json(); }).then(function (d) {
        el.art.disabled = false;
        if (!d.ok) { note(d.error || "box art fetch failed", true); return; }
        var msg = d.note ? d.note
          : d.downloaded + " of " + d.checked + " cover(s) downloaded";
        if (d.missing && d.missing.length) {
          msg += " -- no match for: " + d.missing.slice(0, 4).join(", ") +
                 (d.missing.length > 4 ? " (+" + (d.missing.length - 4) + " more)" : "");
        }
        note(msg);
        if (d.downloaded) {
          window.setTimeout(function () {
            if (window.CloverArcade) window.CloverArcade.reload();
          }, 2500);
        }
      }).catch(function () {
        el.art.disabled = false;
        note("box art fetch failed", true);
      });
    });

    window.addEventListener("beforeunload", function (e) {
      if (state.busy > 0) { e.preventDefault(); e.returnValue = ""; }
    });
  }

  build();
  wire();

  window.CloverUpload = {
    setEnabled: function (on) {
      state.enabled = !!on;
      el.open.hidden = !on;
      if (!on) el.modal.hidden = true;
    }
  };
})();
