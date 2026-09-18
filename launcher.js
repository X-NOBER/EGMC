const FALLBACK_FILES = [
  { file: "Clients/Aero Client.html", category: "client", size: 41548077 },
  { file: "Clients/Astra Client.html", category: "client", size: 59215320 },
  { file: "Clients/EB Client 1.14.4.html", category: "client", size: 42176903 },
  { file: "Clients/EB Client 1.8.8.html", category: "client", size: 22066113 },
  { file: "Clients/Eclipse Client.html", category: "client", size: 46774872 },
  { file: "Clients/GX-Client.html", category: "client", size: 26496650 },
  { file: "Clients/Huzzium Client.html", category: "client", size: 15286205 },
  { file: "Clients/Kozmo Client.html", category: "client", size: 67272908 },
  { file: "Clients/Larp Client 1.14.4.html", category: "client", size: 44016899 },
  { file: "Clients/Myven Client.html", category: "client", size: 84032731 },
  { file: "Clients/Pixel Client.html", category: "client", size: 26494350 },
  { file: "Clients/Precision Client.html", category: "client", size: 33679575 },
  { file: "Clients/Resent Client.html", category: "client", size: 18825211 },
  { file: "Clients/Tuff Client Beta.html", category: "client", size: 30871765 },
  { file: "Vanilla/1.8.8-wasm.html", category: "vanilla", size: 15129081 },
  { file: "Vanilla/1.12.2-wasm.html", category: "vanilla", size: 25066800 },
  { file: "Vanilla/1.13.2-wasm.html", category: "vanilla", size: 54245378 },
  { file: "Vanilla/1.14.4-wasm.html", category: "vanilla", size: 36011556 },
  { file: "Vanilla/1.16.5-wasm.html", category: "vanilla", size: 53138875 },
  { file: "Vanilla/1.20.6-wasm.html", category: "vanilla", size: 55586148 },
  { file: "Vanilla/1.21.11-wasm.html", category: "vanilla", size: 48845015 },
  { file: "Vanilla/26.1.2-wasm.html", category: "vanilla", size: 65694755 },
  { file: "Vanilla/26.2-wasm.html", category: "vanilla", size: 75432618 },
];

const FALLBACK_PACKS = [
  { file: "TexturePacks/Moxiez 16x_1.20.6.zip", version: "1.20.6", size: 25132930 },
  { file: "TexturePacks/Moxiez 16x_1.8.9.zip", version: "1.8.9", size: 25037108 },
  { file: "TexturePacks/Summer 16x_1.20.6.zip", version: "1.20.6", size: 20659648 },
  { file: "TexturePacks/Summer 16x_1.8.9.zip", version: "1.8.9", size: 20672925 },
];

const SKIP_FILES = new Set(["index.html"]);
const MODE_KEY = "eagler.launchMode";
const TAB_KEY = "eagler.tab";
const CDN_BASE = "https://cdn.jsdelivr.net/gh/X-NOBER/EGMC@main/";
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/X-NOBER/EGMC/main/";
const blobUrls = [];

const grid = document.getElementById("grid");
const packList = document.getElementById("pack-list");
const statusEl = document.getElementById("status");
const banner = document.getElementById("banner");
const search = document.getElementById("search");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMsg = document.getElementById("overlay-msg");
const overlayFill = document.getElementById("overlay-fill");
const overlayPct = document.getElementById("overlay-pct");
const cancelBtn = document.getElementById("cancel-launch");
const stage = document.getElementById("stage");
const stageTitle = document.getElementById("stage-title");
const closeStageBtn = document.getElementById("close-stage");
const indicatorBar = document.getElementById("indicator-bar");
const searchWrap = document.getElementById("search-wrap");
const modeIndicator = document.getElementById("mode-indicator");
const overlayProgress = document.getElementById("overlay-progress");
const countAll = document.getElementById("count-all");
const countClient = document.getElementById("count-client");
const countVanilla = document.getElementById("count-vanilla");

let catalog = [];
let packs = [];
let selectedClientFile = "";
let activeTab = localStorage.getItem(TAB_KEY) || "all";
let launchMode = localStorage.getItem(MODE_KEY) || "about-blank";
let abortLaunch = null;
let launchWindow = null;
let launching = false;
let launchingFile = "";
let launchGen = 0;

function showBanner(message) {
  banner.hidden = !message;
  banner.textContent = message || "";
}

function fileName(path) {
  return String(path || "").replace(/\\/g, "/").split("/").pop();
}

function parseClientFile(entry) {
  const file = String(entry.file || entry).replace(/\\/g, "/");
  const size = entry.size || 0;
  const filename = fileName(file);
  const base = filename.replace(/\.html$/i, "");
  const wasm = base.match(/^(.*)-wasm$/i);

  if (wasm || entry.category === "vanilla") {
    const version = wasm ? wasm[1] : base;
    return {
      file,
      name: version,
      category: "vanilla",
      version,
      tag: "Vanilla",
      size,
    };
  }

  let version = null;
  let label = base.replace(/-/g, " ");
  const versionMatch = label.match(/\b(\d+(?:\.\d+){1,3})\b/);
  if (versionMatch) {
    version = versionMatch[1];
    label = label.replace(versionMatch[0], " ");
  }
  const beta = /\bbeta\b/i.test(label);
  label = label.replace(/\bclient\b/gi, " ").replace(/\bbeta\b/gi, " ");
  label = label.replace(/\s+/g, " ").trim() || base;

  return {
    file,
    name: label,
    category: "client",
    version,
    tag: beta ? "Client · Beta" : "Client",
    size,
  };
}

function parsePackFile(entry) {
  const file = String(entry.file || entry).replace(/\\/g, "/");
  const filename = fileName(file);
  const base = filename.replace(/\.zip$/i, "");
  const match = base.match(/^(.*?)[_ ](\d+(?:\.\d+){1,3})$/);
  return {
    file,
    filename,
    name: match ? match[1].replace(/_+/g, " ").trim() : base,
    version: entry.version || (match ? match[2] : null),
    size: entry.size || 0,
  };
}

function versionParts(value) {
  return String(value || "0")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersions(a, b) {
  const left = versionParts(a);
  const right = versionParts(b);
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    const delta = (left[i] || 0) - (right[i] || 0);
    if (delta) return delta;
  }
  return 0;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sortCatalog(items) {
  return [...items].sort((a, b) => {
    if (a.category !== b.category) return a.category === "client" ? -1 : 1;
    if (a.category === "vanilla") return compareVersions(a.version, b.version);
    return a.name.localeCompare(b.name);
  });
}

function packFamily(version) {
  if (!version) return null;
  if (String(version).startsWith("1.8")) return "1.8";
  return String(version);
}

function clientPackFamily(item) {
  if (item?.version) return packFamily(item.version);
  if (item?.category === "client") return "1.8";
  return null;
}

function isPackCompatible(pack, client) {
  const packVer = packFamily(pack.version);
  const clientVer = clientPackFamily(client);
  if (!packVer || !clientVer) return true;
  return packVer === clientVer;
}

function selectedClient() {
  return catalog.find((item) => item.file === selectedClientFile) || null;
}

function updateTabCounts(visibleCount) {
  const clients = catalog.filter((item) => item.category === "client").length;
  const vanilla = catalog.filter((item) => item.category === "vanilla").length;
  if (countAll) countAll.textContent = String(catalog.length);
  if (countClient) countClient.textContent = String(clients);
  if (countVanilla) countVanilla.textContent = String(vanilla);
  return { clients, vanilla, visibleCount };
}

function chip(label, value, tone = "") {
  const el = document.createElement("span");
  el.className = `chip${tone ? ` chip--${tone}` : ""}`;
  el.innerHTML = `<span class="chip-label">${label}</span><span class="chip-value">${value}</span>`;
  return el;
}

function renderIndicators(visibleCount) {
  if (!indicatorBar) return;
  indicatorBar.replaceChildren();

  const query = search.value.trim();
  const client = selectedClient();
  const counts = updateTabCounts(visibleCount);

  indicatorBar.append(chip("Showing", String(visibleCount)));
  indicatorBar.append(chip("Tab", activeTab === "all" ? "All" : activeTab === "client" ? "Clients" : "Vanilla"));

  if (query) {
    indicatorBar.append(chip("Search", `"${query}"`, "accent"));
  }

  indicatorBar.append(chip("Launch", launchMode === "blob" ? "Blob URL" : "about:blank", "accent"));
  indicatorBar.append(chip("Read", "jsDelivr", "ok"));

  if (client) {
    indicatorBar.append(chip("Selected", client.name, "ok"));
  } else {
    indicatorBar.append(chip("Selected", "None", "muted"));
  }

  if (launching && launchingFile) {
    const launchingItem = catalog.find((item) => item.file === launchingFile);
    indicatorBar.append(chip("Status", launchingItem ? `Launching ${launchingItem.name}` : "Launching…", "busy"));
  }

  if (stage && !stage.hidden) {
    indicatorBar.append(chip("Playing", stageTitle.textContent || "In launcher", "ok"));
  }

  indicatorBar.append(chip("Packs", String(packs.length), "muted"));
  indicatorBar.append(chip("Clients", String(counts.clients), "client"));
  indicatorBar.append(chip("Vanilla", String(counts.vanilla), "vanilla"));

  if (searchWrap) {
    searchWrap.classList.toggle("has-filter", Boolean(query));
  }
}

function setStatus(text) {
  statusEl.classList.add("is-updating");
  window.requestAnimationFrame(() => {
    statusEl.textContent = text;
    window.requestAnimationFrame(() => {
      statusEl.classList.remove("is-updating");
    });
  });
}

function visibleItems() {
  const query = search.value.trim().toLowerCase();
  return catalog.filter((item) => {
    if (activeTab !== "all" && item.category !== activeTab) return false;
    if (!query) return true;
    return `${item.name} ${item.tag} ${item.version || ""} ${item.file}`.toLowerCase().includes(query);
  });
}

function renderPacks() {
  packList.replaceChildren();
  const client = selectedClient();

  if (!packs.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No zips in TexturePacks.";
    packList.append(empty);
    return;
  }

  for (let i = 0; i < packs.length; i += 1) {
    const pack = packs[i];
    const compatible = !client || isPackCompatible(pack, client);
    const link = document.createElement("a");
    link.style.setProperty("--n", String(i));
    const dotClass = !client ? "ind-dot--muted" : compatible ? "ind-dot--ok" : "ind-dot--warn";
    const fitLabel = !client ? "Pick a client to check fit" : compatible ? "Fits selected client" : "Wrong MC version";
    link.className = `pack${compatible ? "" : " is-incompatible"}${!client ? " is-neutral" : ""}`;
    link.href = cdnUrl(pack.file).href;
    link.rel = "noopener noreferrer";
    link.innerHTML = `
      <div class="pack-row">
        <span class="ind-dot ${dotClass}" aria-hidden="true"></span>
        <div class="pack-body">
          <strong>${pack.name}</strong>
          <span class="pack-meta">${pack.version || "?"} · ${formatBytes(pack.size)}</span>
          <span class="pack-fit">${fitLabel}</span>
          <span class="download-label">Download zip</span>
        </div>
      </div>
    `;
    packList.append(link);
  }
}

function render() {
  const items = visibleItems();
  grid.replaceChildren();

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = catalog.length ? "No matches." : "No client HTML files found in Clients or Vanilla.";
    grid.append(empty);
    setStatus("0 shown");
    renderPacks();
    renderIndicators(0);
    return;
  }

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const card = document.createElement("article");
    card.style.setProperty("--n", String(Math.min(i, 14)));
    const isSelected = item.file === selectedClientFile;
    const isLaunching = launching && item.file === launchingFile;
    card.className = `card ${item.category}${isSelected ? " is-selected" : ""}${isLaunching ? " is-launching" : ""}`;
    card.setAttribute("aria-selected", String(isSelected));
    const dotClass = item.category === "vanilla" ? "ind-dot--vanilla" : "ind-dot--client";
    const selectedMark = isSelected ? '<span class="card-flag">Selected</span>' : "";
    const launchMark = isLaunching ? '<span class="card-flag card-flag--busy">Launching</span>' : "";
    card.innerHTML = `
      <div class="card-top">
        <span class="badge"><span class="ind-dot ${dotClass}" aria-hidden="true"></span>${item.tag}</span>
        <span class="size">${formatBytes(item.size)}</span>
      </div>
      ${selectedMark}
      ${launchMark}
      <h2>${item.name}</h2>
      <p class="meta">${item.category === "vanilla" ? "WASM build" : (item.version || "Custom client")}</p>
      <button type="button" class="play"${isLaunching ? " disabled" : ""}>${isLaunching ? "Launching…" : "Play"}</button>
    `;
    card.addEventListener("click", () => {
      selectedClientFile = item.file;
      render();
    });
    card.querySelector(".play").addEventListener("click", (event) => {
      event.stopPropagation();
      selectedClientFile = item.file;
      renderPacks();
      launch(item);
    });
    card.addEventListener("dblclick", () => launch(item));
    grid.append(card);
  }

  setStatus(`${items.length} shown in grid`);
  renderPacks();
  renderIndicators(items.length);
}

function bindTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.tab;
      localStorage.setItem(TAB_KEY, activeTab);
      bindTabState();
      render();
    });
  });
}

function bindTabState() {
  document.querySelectorAll(".tab").forEach((tab) => {
    const selected = tab.dataset.tab === activeTab;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
}

const MODE_HELP = {
  "about-blank": "Writes the client into a blank tab. Worlds usually save.",
  blob: "Opens a temporary blob: tab. More isolated; saves may not persist.",
};

function bindLaunchMode() {
  const buttons = [...document.querySelectorAll(".mode-btn")];
  const help = document.getElementById("mode-help");

  const apply = () => {
    for (const button of buttons) {
      const active = button.dataset.mode === launchMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-checked", String(active));
    }
    help.textContent = MODE_HELP[launchMode] || MODE_HELP["about-blank"];
    if (modeIndicator) {
      modeIndicator.textContent = launchMode === "blob" ? "Blob URL" : "about:blank";
    }
    renderIndicators(visibleItems().length);
  };

  for (const button of buttons) {
    button.addEventListener("click", () => {
      launchMode = button.dataset.mode;
      localStorage.setItem(MODE_KEY, launchMode);
      apply();
    });
  }
  apply();
}

function loadingDocument(name) {
  const safe = name.replace(/[<>&]/g, "");
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Loading ${safe}</title>
  <style>
    html,body{height:100%;margin:0;background:#07090c;color:#d9f5e4;font-family:Segoe UI,sans-serif;}
    body{display:grid;place-items:center;}
    .box{width:min(28rem,calc(100% - 2rem));text-align:center;}
    h1{margin:0 0 .4rem;font-size:1.15rem;}
    p{color:#8fa397;}
    .bar{height:8px;background:#121816;border-radius:99px;overflow:hidden;}
    .fill{height:100%;width:0;background:#6ee7a8;}
  </style>
</head>
<body>
  <div class="box">
    <h1>Loading ${safe}</h1>
    <p id="msg">Opening client…</p>
    <div class="bar"><div class="fill" id="fill"></div></div>
    <p id="pct">0%</p>
  </div>
</body>
</html>`;
}

function setProgress(percent, message, received, total) {
  const width = Math.max(0, Math.min(100, percent));
  overlayFill.style.width = `${width}%`;
  if (overlayProgress) {
    overlayProgress.setAttribute("aria-valuenow", String(Math.round(width)));
  }
  overlayPct.textContent = total
    ? `${width.toFixed(0)}% · ${formatBytes(received)} / ${formatBytes(total)}`
    : `${width.toFixed(0)}%`;
  if (message) overlayMsg.textContent = message;

  if (launchWindow && !launchWindow.closed) {
    try {
      const fill = launchWindow.document.getElementById("fill");
      const pct = launchWindow.document.getElementById("pct");
      const msg = launchWindow.document.getElementById("msg");
      if (fill) fill.style.width = `${width}%`;
      if (pct) pct.textContent = overlayPct.textContent;
      if (msg && message) msg.textContent = message;
    } catch {
      // The game document may already have replaced the loader.
    }
  }
}

function closeOverlay() {
  overlay.hidden = true;
  abortLaunch = null;
}

function stopLaunchWork({ closeWindow = true } = {}) {
  if (abortLaunch) {
    abortLaunch.abort();
    abortLaunch = null;
  }
  if (closeWindow && launching && launchWindow && !launchWindow.closed) {
    launchWindow.close();
  }
  launching = false;
  launchingFile = "";
  overlay.hidden = true;
}

function cancelCurrentLaunch() {
  launchGen += 1;
  stopLaunchWork({ closeWindow: true });
  render();
}

async function streamToBlob(stream, total, type, onProgress, signal) {
  const reader = stream.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(total ? (received / total) * 100 : 0, received, total);
  }
  return new Blob(chunks, { type });
}

function cdnUrl(path, base = CDN_BASE) {
  const encoded = String(path)
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return new URL(encoded, base);
}

async function readClientHttp(url, onProgress, signal) {
  const response = await fetch(url, { signal, mode: "cors" });
  if (!response.ok) {
    throw new Error(`Could not fetch ${url.href} (${response.status})`);
  }
  const total = Number(response.headers.get("Content-Length")) || 0;
  if (response.body) {
    return streamToBlob(response.body, total, "text/html", onProgress, signal);
  }
  const blob = await response.blob();
  onProgress(100, blob.size, blob.size);
  return blob;
}

async function loadClientBlob(path, onProgress, signal) {
  try {
    return await readClientHttp(cdnUrl(path), onProgress, signal);
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    return readClientHttp(cdnUrl(path, GITHUB_RAW_BASE), onProgress, signal);
  }
}

function closeStage() {
  stage.querySelectorAll("iframe").forEach((frame) => frame.remove());
  stage.hidden = true;
  showBanner("");
  renderIndicators(visibleItems().length);
}

function openBlankWindow() {
  try {
    const win = window.open("about:blank", "eaglercraft-client");
    if (win && !win.closed) return win;
  } catch {
    // Popup blocked.
  }
  return null;
}

function writeHtmlDocument(doc, html) {
  if (!doc) throw new Error("Could not write HTML into about:blank.");
  doc.open("text/html", "replace");
  doc.write(html);
  doc.close();
}

async function putHtmlInTarget(target, mode, blob) {
  if (mode === "blob") {
    const blobUrl = URL.createObjectURL(blob);
    blobUrls.push(blobUrl);
    if (target.location) {
      target.location.replace(blobUrl);
    } else {
      target.src = blobUrl;
    }
    return;
  }

  const html = await blob.text();
  if (target.document) {
    writeHtmlDocument(target.document, html);
    return;
  }
  const doc = target.contentDocument;
  writeHtmlDocument(doc, html);
}

async function playInLauncher(item, mode, blob) {
  closeStage();
  stageTitle.textContent = item.name;
  const frame = document.createElement("iframe");
  frame.title = item.name;
  frame.allow = "fullscreen; pointer-lock; clipboard-read; clipboard-write; autoplay; gamepad";
  frame.setAttribute("allowfullscreen", "true");
  frame.src = "about:blank";
  stage.append(frame);
  stage.hidden = false;
  renderIndicators(visibleItems().length);
  await putHtmlInTarget(frame, mode, blob);
}

async function launch(item) {
  const mode = launchMode;
  // Open the tab while the click is still a user gesture. Re-rendering the
  // grid first removes the Play button and browsers then block window.open.
  const win = openBlankWindow();
  const gen = launchGen + 1;
  launchGen = gen;

  if (abortLaunch) {
    abortLaunch.abort();
    abortLaunch = null;
  }
  if (launchWindow && launchWindow !== win && !launchWindow.closed) {
    launchWindow.close();
  }

  launching = true;
  launchingFile = item.file;
  launchWindow = win;

  overlay.hidden = false;
  overlayTitle.textContent = item.name;
  setProgress(0, "Fetching from CDN…", 0, item.size);
  render();

  const inPage = !win;
  if (inPage) {
    showBanner("Popups are blocked, so this client will open in the launcher window. Allow popups to use a separate tab.");
  } else {
    showBanner("");
    try {
      writeHtmlDocument(win.document, loadingDocument(item.name));
    } catch {
      // Fetch + inject can still replace this tab.
    }
  }

  const controller = new AbortController();
  abortLaunch = controller;

  try {
    const fileBlob = await loadClientBlob(
      item.file,
      (percent, received, total) => {
        if (gen !== launchGen) return;
        setProgress(percent, "Fetching from CDN…", received, total);
      },
      controller.signal,
    );
    const blob = new Blob([fileBlob], { type: "text/html" });

    if (gen !== launchGen) return;
    if (!inPage && (!launchWindow || launchWindow.closed)) return;
    setProgress(100, "Writing into " + (mode === "blob" ? "blob URL" : "about:blank") + "…", blob.size, blob.size);

    if (inPage) {
      await playInLauncher(item, mode, blob);
      return;
    }

    await putHtmlInTarget(launchWindow, mode, blob);
    launchWindow.focus();
  } catch (error) {
    if (error?.name === "AbortError" || gen !== launchGen) return;
    showBanner(error.message || "Could not fetch client HTML.");
    if (launchWindow && !launchWindow.closed) {
      try {
        writeHtmlDocument(
          launchWindow.document,
          loadingDocument("Fetch failed"),
        );
        const msg = launchWindow.document.getElementById("msg");
        if (msg) msg.textContent = error.message || "Could not fetch client HTML.";
      } catch {
        launchWindow.close();
      }
    }
  } finally {
    if (gen !== launchGen) return;
    launching = false;
    launchingFile = "";
    closeOverlay();
    render();
  }
}

function loadCatalog() {
  catalog = sortCatalog(FALLBACK_FILES.map((entry) => parseClientFile(entry)));
  packs = FALLBACK_PACKS.map((entry) => parsePackFile(entry));
  showBanner("");
  render();
}

bindTabs();
bindTabState();
bindLaunchMode();
search.addEventListener("input", render);
cancelBtn.addEventListener("click", cancelCurrentLaunch);
closeStageBtn.addEventListener("click", closeStage);
loadCatalog();
