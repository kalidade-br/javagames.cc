import { openDesktopControlsModal, updateIndexPageKeyBadges } from "./desktopKeyManager.js";

// note that we can only call java stuff if thread not running..
function getCheerpjWebRoot() {
    let p = location.pathname;
    p = p.replace(/\/(run|index)(\.html)?$/i, '');
    if (p.endsWith('.html') || p.endsWith('.js')) {
        p = p.substring(0, p.lastIndexOf('/'));
    }
    p = p.replace(/\/+$/, '');
    return '/app' + (p ? p : '');
}
const cheerpjWebRoot = getCheerpjWebRoot();

function getErrorMessage(err) {
    if (!err) return "Unknown error";
    if (typeof err === "string") return err;
    if (err.message && typeof err.message === "string") return err.message;
    try {
        if (typeof err.toString === "function") {
            const str = err.toString();
            if (typeof str === "string") return str;
        }
    } catch (e) {}
    try {
        return JSON.stringify(err);
    } catch (e) {}
    return "Error: " + String(Object.prototype.toString.call(err));
}

const emptyIcon = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

let lib = null, launcherUtil = null;
let state = {
    games: [],
    currentGame: null,
    editedGameId: null,
    uploadedJars: 0,
};
let defaultSettings = {};

async function main() {
    try {
        const loadingEl = document.getElementById("loading");
        const statusEl = document.getElementById("loading-status-text") || loadingEl;
        if (statusEl) statusEl.textContent = "Booting CheerpJ Java Engine...";
        await cheerpjInit({
            enableDebug: false
        });

        if (statusEl) statusEl.textContent = "Loading J2ME Web Loader...";
        lib = await cheerpjRunLibrary(cheerpjWebRoot+"/j2me-web-loader.jar");

        launcherUtil = await lib.pl.zb3.freej2me.launcher.LauncherUtil;

        await launcherUtil.resetTmpDir();

        const Config = await lib.org.recompile.freej2me.Config;
        await javaToKv(Config.DEFAULT_SETTINGS, defaultSettings);

        if (statusEl) statusEl.textContent = "Loading games from games.json...";
        await reloadUI((msg) => {
            if (statusEl) statusEl.textContent = msg;
        });

        if (loadingEl) loadingEl.style.display = "none";
        const mainEl = document.getElementById("main");
        if (mainEl) mainEl.style.display = "";

        document.getElementById("clear-current").onclick = () => setupAddMode(true);

        document.getElementById("import-data-btn").addEventListener("click", () => {
            document.getElementById("import-data-file").click();
        });

        document.getElementById("import-data-file").onchange = doImportData;
        document.getElementById("export-data-btn").onclick = doExportData;

        // Hook up Reload games.json catalog button
        const reloadCatalogBtn = document.getElementById("reload-catalog-btn");
        if (reloadCatalogBtn) {
            reloadCatalogBtn.onclick = async () => {
                const orig = reloadCatalogBtn.innerHTML;
                reloadCatalogBtn.disabled = true;
                reloadCatalogBtn.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin text-cyan-600 inline mr-1" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> <span>Reloading...</span>`;
                await reloadUI();
                reloadCatalogBtn.disabled = false;
                reloadCatalogBtn.innerHTML = orig;
            };
        }

        // Hook up Direct URL download button and enter key
        const downloadUrlBtn = document.getElementById("download-url-btn");
        const gameUrlInput = document.getElementById("game-url-input");
        if (downloadUrlBtn && gameUrlInput) {
            downloadUrlBtn.onclick = async () => {
                const url = (gameUrlInput.value || "").trim();
                if (!url) return;
                await handleDirectUrlInstall(url);
            };
            gameUrlInput.addEventListener("keydown", async (e) => {
                if (e.key === "Enter") {
                    const url = (gameUrlInput.value || "").trim();
                    if (!url) return;
                    await handleDirectUrlInstall(url);
                }
            });
        }

        updateIndexPageKeyBadges();
        const desktopKeysBtn = document.getElementById("configure-desktop-keys-btn");
        if (desktopKeysBtn) {
            desktopKeysBtn.onclick = () => {
                openDesktopControlsModal(updateIndexPageKeyBadges);
            };
        }
    } catch (err) {
        console.error("Failed to initialize launcher:", err);
        const loadingEl = document.getElementById("loading");
        if (loadingEl) {
            loadingEl.style.color = "#dc3545";
            loadingEl.textContent = "Error loading launcher: " + getErrorMessage(err);
        }
    }
}

async function maybeReadCheerpJFileText(path) {
    const blob = await cjFileBlob(path);
    if (blob) {
        return await blob.text();
    }
}

async function getDataUrlFromBlob(blob) {
    const reader = new FileReader();

    const promise = new Promise((r) => {
        reader.onload = function () {
            r(reader.result);
        };
    });

    reader.readAsDataURL(blob);
    return await promise;
}

function readToKv(txt, kv) {
    for (const line of txt.trim().split("\n")) {
        const parts = line.split(/\s*:\s*/);
        if (parts.length == 2) {
            kv[parts[0]] = parts[1];
        }
    }
}

async function javaToKv(hashMap, kv) {
    const es = await hashMap.entrySet();
    const esi = await es.iterator();

    while (await esi.hasNext()) {
        const entry = await esi.next();
        const key = await entry.getKey();
        const value = await entry.getValue();

        kv[key] = value;
    }
}

async function kvToJava(kv) {
    const HashMap = await lib.java.util.HashMap;
    const ret = await new HashMap();

    for (const k of Object.keys(kv)) {
        await ret.put(k, kv[k]);
    }

    return ret;
}

async function fetchJarBuffer(url) {
    if (!url) throw new Error("No URL provided");

    const urlsToTry = [url];
    if (/diamondrush/i.test(url)) {
        const fixed = url.replace(/diamondrush/i, 'DiamondRush');
        if (!urlsToTry.includes(fixed)) urlsToTry.push(fixed);
    }

    let lastError = null;
    for (const u of urlsToTry) {
        try {
            const directRes = await fetch(u);
            if (directRes.ok) {
                const buf = await directRes.arrayBuffer();
                if (buf && buf.byteLength > 50) return buf;
            }
        } catch (e) {
            console.warn("Direct fetch failed for:", u, e);
        }

        try {
            const proxyUrl = "/api/proxy-jar?url=" + encodeURIComponent(u);
            const proxyRes = await fetch(proxyUrl);
            if (proxyRes.ok) {
                const buf = await proxyRes.arrayBuffer();
                if (buf && buf.byteLength > 50) return buf;
            } else {
                lastError = new Error(`HTTP ${proxyRes.status} ${proxyRes.statusText}`);
            }
        } catch (err) {
            lastError = err;
        }
    }

    throw lastError || new Error("Failed to download JAR file");
}

async function installJarFromBuffer(arrayBuffer, fileName) {
    const MIDletLoader = await lib.org.recompile.mobile.MIDletLoader;
    const File = await lib.java.io.File;

    const tmpJarFile = await new File(
        "/files/_tmp/" + (state.uploadedJars++) + ".jar"
    );

    await launcherUtil.copyJar(new Int8Array(arrayBuffer), tmpJarFile);

    const AnalyserUtil = await lib.pl.zb3.freej2me.launcher.AnalyserUtil;
    const analysisResult = await AnalyserUtil.analyseFile(tmpJarFile, fileName);

    const guessedSettings = { ...defaultSettings };
    fillGuessedSettings(analysisResult, { settings: guessedSettings });

    const loader = await MIDletLoader.getMIDletLoader(tmpJarFile);
    let appId = await loader.getAppId();
    if (!appId) {
        await launcherUtil.ensureAppId(loader, fileName);
        appId = await loader.getAppId();
    }

    const appProps = {};
    if (loader.properties) {
        try {
            await javaToKv(loader.properties, appProps);
        } catch (e) {}
    }

    const jsettings = await kvToJava(guessedSettings);
    const jappProps = await kvToJava(appProps);
    const jsysProps = await kvToJava({});

    await launcherUtil.initApp(
        tmpJarFile,
        loader,
        jsettings,
        jappProps,
        jsysProps
    );

    try {
        await loader.close();
    } catch (e) {}

    return appId;
}

function parseGameEntry(item) {
    if (typeof item === 'string') {
        const url = item.trim();
        if (!url) return null;
        const rawFilename = url.split('/').pop().split('?')[0] || "game.jar";
        let cleanName = decodeURIComponent(rawFilename)
            .replace(/\.jar$/i, '')
            .replace(/[-_]+/g, ' ')
            .trim();
        return {
            url,
            rawFilename,
            name: cleanName || "Java Game",
            appId: "cloud_" + rawFilename.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
        };
    } else if (item && typeof item === 'object') {
        const url = (item.url || item.link || '').trim();
        if (!url) return null;
        const rawFilename = url.split('/').pop().split('?')[0] || "game.jar";
        let cleanName = item.name || item.title || decodeURIComponent(rawFilename).replace(/\.jar$/i, '').replace(/[-_]+/g, ' ').trim();
        return {
            url,
            rawFilename,
            name: cleanName || "Java Game",
            appId: item.appId || "cloud_" + rawFilename.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
            icon: item.icon || null
        };
    }
    return null;
}

async function loadGamesJson() {
    try {
        const res = await fetch("games.json");
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                return data;
            } else if (data && Array.isArray(data.games)) {
                return data.games;
            }
        }
    } catch (e) {
        console.warn("Could not load games.json:", e);
    }
    return [];
}

async function downloadAndLaunchGame(game, playBtn) {
    if (!game.remoteUrl) return;
    const origHtml = playBtn.innerHTML;
    playBtn.disabled = true;
    playBtn.innerHTML = `
        <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        <span>Loading...</span>
    `;

    try {
        const buf = await fetchJarBuffer(game.remoteUrl);
        playBtn.innerHTML = `<span>Installing...</span>`;
        const appId = await installJarFromBuffer(buf, game.rawFilename || "game.jar");
        const isMobile = ('ontouchstart' in window) || (window.innerWidth <= 768);
        location.href = "run?app=" + appId + (isMobile ? "&mobile=1" : "");
    } catch (err) {
        console.error("Failed to download and launch game:", err);
        playBtn.disabled = false;
        playBtn.innerHTML = origHtml;
        alert(`Could not download game from:\n${game.remoteUrl}\n\n${getErrorMessage(err)}\n\nPlease ensure the link is reachable.`);
    }
}

async function loadGames(statusUpdater = null) {
    const apps = [];

    // 1. Read catalog from games.json
    const catalogEntries = await loadGamesJson();
    const catalogParsed = catalogEntries.map(parseGameEntry).filter(Boolean);

    // 2. Read existing installed apps
    let installedAppsBlob = await cjFileBlob("/files/apps.list");
    let installedIds = [];
    if (installedAppsBlob) {
        installedIds = (await installedAppsBlob.text()).trim().split("\n").filter(Boolean);
    }

    // 3. Auto-install games from games.json that are not installed yet
    for (const item of catalogParsed) {
        const alreadyInstalled = installedIds.some(id => 
            id === item.appId ||
            id.toLowerCase() === item.rawFilename.replace(/\.jar$/i, '').toLowerCase() ||
            id.toLowerCase() === item.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
        );

        if (!alreadyInstalled) {
            if (statusUpdater) {
                statusUpdater(`Downloading ${item.name}...`);
            }
            try {
                const buf = await fetchJarBuffer(item.url);
                if (buf) {
                    if (statusUpdater) {
                        statusUpdater(`Installing ${item.name}...`);
                    }
                    const newAppId = await installJarFromBuffer(buf, item.rawFilename);
                    installedIds.push(newAppId);
                }
            } catch (err) {
                console.warn(`Could not auto-install ${item.name} (${item.url}):`, err);
            }
        }
    }

    // 4. Load full installed apps data from CheerpJ virtual file system
    installedAppsBlob = await cjFileBlob("/files/apps.list");
    if (installedAppsBlob) {
        installedIds = [...new Set((await installedAppsBlob.text()).trim().split("\n").filter(Boolean))];

        for (const appId of installedIds) {
            const napp = {
                appId,
                name: appId,
                icon: emptyIcon,
                settings: { ...defaultSettings },
                appProperties: {},
                systemProperties: {},
                isInstalled: true,
            };

            const name = await maybeReadCheerpJFileText("/files/" + appId + "/name");
            if (name) napp.name = name;

            const iconBlob = await cjFileBlob("/files/" + appId + "/icon");
            if (iconBlob) {
                const dataUrl = await getDataUrlFromBlob(iconBlob);
                if (dataUrl) {
                    napp.icon = dataUrl;
                }
            }

            for (const [fname, keyName] of [
                ["/files/" + appId + "/config/settings.conf", "settings"],
                ["/files/" + appId + "/config/appproperties.conf", "appProperties"],
                ["/files/" + appId + "/config/systemproperties.conf", "systemProperties"],
            ]) {
                const content = await maybeReadCheerpJFileText(fname);
                if (content) {
                    readToKv(content, napp[keyName]);
                }
            }

            const kbdLayoutContent = await maybeReadCheerpJFileText("/files/" + appId + "/config/keypad_layout.json");
            if (kbdLayoutContent && kbdLayoutContent.trim()) {
                localStorage.setItem("j2me_kbd_layout_" + appId, kbdLayoutContent.trim());
            }

            apps.push(napp);
        }

        const dmapContent = await maybeReadCheerpJFileText("/files/desktop_key_map.json");
        if (dmapContent && dmapContent.trim()) {
            localStorage.setItem("j2me_desktop_key_map", dmapContent.trim());
        }
    }

    // 5. If any game in games.json wasn't able to auto-install (e.g. offline link),
    // display it as a games.json Cloud item so the user can see it and retry download
    for (const item of catalogParsed) {
        const matchesInstalled = apps.some(a => 
            a.appId === item.appId || 
            a.name.toLowerCase() === item.name.toLowerCase() ||
            a.appId.toLowerCase() === item.rawFilename.replace(/\.jar$/i, '').toLowerCase()
        );
        if (!matchesInstalled) {
            apps.push({
                appId: item.appId,
                name: item.name,
                icon: item.icon || emptyIcon,
                remoteUrl: item.url,
                rawFilename: item.rawFilename,
                isCloudPending: true,
                settings: { ...defaultSettings },
                appProperties: {},
                systemProperties: {},
            });
        }
    }

    return apps;
}

function fillGamesList(games) {
    const container = document.getElementById("game-list");
    container.innerHTML = "";

    if (!games || games.length === 0) {
        container.innerHTML = `
            <div class="col-span-full p-8 text-center text-slate-500 bg-cyan-50/50 rounded-2xl border-2 border-dashed border-cyan-200/80 w-full">
                <div class="w-12 h-12 rounded-2xl bg-white border border-cyan-200 text-cyan-600 flex items-center justify-center mx-auto mb-3 shadow-2xs overflow-hidden">
                    <img src="java_icon.svg" alt="Java Icon" class="w-8 h-8 object-contain" />
                </div>
                <p class="font-bold text-slate-800 text-base">No Games Available</p>
                <p class="text-xs text-slate-500 mt-1">Add direct links to <span class="font-mono text-cyan-700 bg-cyan-50 px-1 py-0.5 rounded border border-cyan-200">games.json</span> or upload a Java .JAR file below.</p>
            </div>
        `;
        return;
    }

    for (const game of games) {
        const item = document.createElement("div");
        item.className = "game-item group relative bg-white border border-slate-200 rounded-2xl p-4 transition-all duration-300 hover:border-cyan-400 hover:shadow-md hover:shadow-cyan-500/5 flex items-center justify-between gap-3";

        const iconWrapper = document.createElement("div");
        iconWrapper.className = "w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-all duration-300 shadow-2xs";

        const icon = document.createElement("img");
        icon.className = "icon w-full h-full object-contain";
        icon.src = (game.icon && game.icon !== emptyIcon) ? game.icon : "java_icon.svg";
        iconWrapper.appendChild(icon);

        const info = document.createElement("div");
        info.className = "game-info flex-grow min-w-0";

        const title = document.createElement("h3");
        title.className = "text-sm font-bold text-slate-800 truncate group-hover:text-cyan-600 transition-colors";
        title.textContent = game.name;

        const sub = document.createElement("div");
        sub.className = "text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5 truncate";
        if (game.isCloudPending) {
            sub.innerHTML = `<span class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-sans font-semibold">games.json</span> <span class="truncate">${game.rawFilename || 'Direct Link'}</span>`;
        } else {
            sub.innerHTML = `<span class="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200 text-[10px] font-sans font-semibold">Installed</span> <span class="truncate">${game.appId}</span>`;
        }

        info.appendChild(title);
        info.appendChild(sub);

        const playBtn = document.createElement("button");
        playBtn.type = "button";
        playBtn.className = "px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold shadow-2xs transition-all flex items-center gap-1 shrink-0 cursor-pointer";
        playBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> Play`;

        if (game.isCloudPending) {
            playBtn.onclick = async (e) => {
                e.stopPropagation();
                await downloadAndLaunchGame(game, playBtn);
            };
        } else {
            playBtn.onclick = () => {
                const isMobile = ('ontouchstart' in window) || (window.innerWidth <= 768);
                location.href = "run?app=" + game.appId + (isMobile ? "&mobile=1" : "");
            };
        }

        const leftBlock = document.createElement("div");
        leftBlock.className = "flex items-center gap-3.5 flex-grow min-w-0 cursor-pointer";
        leftBlock.onclick = () => {
            playBtn.click();
        };

        leftBlock.appendChild(iconWrapper);
        leftBlock.appendChild(info);
        item.appendChild(leftBlock);
        item.appendChild(playBtn);

        if (!game.isCloudPending) {
            const manageButton = document.createElement("button");
            manageButton.className = "px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-cyan-50 hover:text-cyan-700 text-slate-600 text-xs font-semibold border border-slate-200 transition-colors flex items-center gap-1 shrink-0 cursor-pointer";
            manageButton.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`;
            manageButton.title = "Manage Game Settings";
            manageButton.onclick = (e) => {
                e.stopPropagation();
                openEditGame(game);
            };
            item.appendChild(manageButton);
        }

        container.appendChild(item);
    }
}

function setupAddMode(shouldScroll = false) {
    if (!confirmDiscard()) {
        return;
    }
    state.currentGame = {
        icon: emptyIcon,
        settings: { ...defaultSettings },
        appProperties: {},
        systemProperties: {},
    };

    document.getElementById("add-edit-text").textContent = "Add New Game";

    document.getElementById("file-input-step").style.display = "";
    document.getElementById("file-input-loading").style.display = "none";
    document.getElementById("file-input-jad-step").style.display = "none";
    document.getElementById("add-manage-step").style.display = "none";

    document.getElementById("game-file-input").disabled = false;
    document.getElementById("game-file-input").value = null;

    if (shouldScroll) {
        document.getElementById("add-edit-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    document.getElementById("game-file-input").onchange = (e) => {
        // read file to arraybuffer
        const file = e.target.files[0];
        if (file) {
            document.getElementById("game-file-input").disabled = true;
            document.getElementById("file-input-step").style.display = "none";
            document.getElementById("file-input-loading").style.display = "";

            const reader = new FileReader();
            reader.onload = async () => {
                const arrayBuffer = reader.result;
                await processGameFile(arrayBuffer, file.name);
            };
            reader.readAsArrayBuffer(file);
        }
    };
}

async function processGameFile(fileBuffer, fileName) {
    const MIDletLoader = await lib.org.recompile.mobile.MIDletLoader;
    const File = await lib.java.io.File;

    const jarFile = await new File(
        "/files/_tmp/" + state.uploadedJars++ + ".jar"
    );

    await launcherUtil.copyJar(new Int8Array(fileBuffer), jarFile);
    state.currentGame.jarFile = jarFile;

    const AnalyserUtil = await lib.pl.zb3.freej2me.launcher.AnalyserUtil;
    const analysisResult = await AnalyserUtil.analyseFile(jarFile, fileName);
    fillGuessedSettings(analysisResult, state.currentGame);

    if (state.lastLoader) {
        await state.lastLoader.close();
    }
    const loader = await MIDletLoader.getMIDletLoader(jarFile);
    state.lastLoader = loader;

    if (!(await loader.getAppId())) {
        document.getElementById("file-input-step").style.display = "";
        document.getElementById("file-input-loading").style.display = "none";
        document.getElementById("file-input-jad-step").style.display = "";
        document.getElementById("upload-descriptor-file-input").value = null;

        document.getElementById("upload-descriptor-file-input").onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById("file-input-step").style.display = "none";
                document.getElementById("file-input-jad-step").style.display = "none";
                document.getElementById("file-input-loading").style.display = "";

                const reader = new FileReader();
                reader.onload = async () => {
                    const arrayBuffer = reader.result;
                    await launcherUtil.augementLoaderWithJAD(
                        loader,
                        new Int8Array(arrayBuffer)
                    );

                    if (await loader.getAppId()) {
                        setupNewGameManage(loader);
                    }
                };
                reader.readAsArrayBuffer(file);
            }
        };

        document.getElementById('continue-without-jad').onclick = () => {
            continueWithoutJAD(loader, fileName);
        };
    } else {
        setupNewGameManage(loader);
    }
}

function fillGuessedSettings(analysisResult, app) {
    if (analysisResult.screenWidth !== -1) {
        app.settings.width = analysisResult.screenWidth + '';
        app.settings.height = analysisResult.screenHeight + '';
    }

    if (analysisResult.phoneType) {
        app.settings.phone = analysisResult.phoneType;
    }
}

async function continueWithoutJAD(loader, origName) {
    // if we're here then need fallback name
    await launcherUtil.ensureAppId(loader, origName);
    loader.name = await loader.getAppId();

    setupNewGameManage(loader);
}

async function setupNewGameManage(loader) {
    state.currentGame.appId = await loader.getAppId();
    state.currentGame.name = loader.name || state.currentGame.appId;
    const iconBytes = await loader.getIconBytes();
    state.currentGame.icon = iconBytes
        ? await getDataUrlFromBlob(new Blob([iconBytes]))
        : emptyIcon;

    await javaToKv(loader.properties, state.currentGame.appProperties);

    setupAddManageGame(state.currentGame, true);
}

async function setupAddManageGame(app, isAdding) {
    document.getElementById("file-input-step").style.display = "none";
    document.getElementById("file-input-jad-step").style.display = "none";
    document.getElementById("file-input-loading").style.display = "none";
    document.getElementById("add-manage-step").style.display = "";

    document.getElementById("add-edit-section")?.scrollIntoView({ behavior: "smooth", block: "start" });

    const previewIcon = document.querySelector(".preview-icon");
    previewIcon.src = app.icon || emptyIcon;

    const previewName = document.querySelector(".preview-name");
    previewName.textContent = app.name;

    const previewControls = document.getElementById("preview-controls");
    previewControls.style.display = isAdding ? "none" : "";
    if (!isAdding) {
        document.getElementById("uninstall-btn").disabled = false;
        document.getElementById("uninstall-btn").onclick = (e) => {
            if (!confirm("Do you want to uninstall " + app.name + "?")) {
                return;
            }

            document.getElementById("uninstall-btn").disabled = true;
            doUninstallGame(app.appId);
        };

        document.getElementById("wipe-data-btn").disabled = false;
        document.getElementById("wipe-data-btn").onclick = (e) => {
            if (!confirm("Do you want wipe " + app.name + " rms storage?")) {
                return;
            }

            document.getElementById("wipe-data-btn").disabled = true;
            doWipeData(app.appId);
        };
    }

    const jadFileInput = document.getElementById("aux-jad-file-input");
    jadFileInput.value = null;
    jadFileInput.onchange = handleOptionalJadFileUpload;

    const phoneType = document.getElementById("phoneType");
    phoneType.value = app.settings.phone;

    const screenSize = document.getElementById("screenSize");

    const sizeStr = `${app.settings.width}x${app.settings.height}`;
    if ([...screenSize.options].some((opt) => opt.value === sizeStr)) {
        screenSize.value = sizeStr;
    } else {
        screenSize.value = "custom";
    }
    document.getElementById("customWidth").value = app.settings.width;
    document.getElementById("customHeight").value = app.settings.height;
    screenSize.onchange = adjustScreenSizeInput;
    adjustScreenSizeInput();

    const fontSize = document.getElementById("fontSize");
    if (app.settings.fontSize) {
        fontSize.value = app.settings.fontSize;
    }

    const dgFormat = document.getElementById("dgFormat");
    if (app.settings.dgFormat) {
        dgFormat.value = app.settings.dgFormat;
    }

    document.querySelector('input[name="enableSound"]').checked = app.settings.sound === "on";
    document.querySelector('input[name="rotate"]').checked = app.settings.rotate === "on";
    document.querySelector('input[name="forceFullscreen"]').checked = app.settings.forceFullscreen === "on";
    document.querySelector('input[name="textureDisableFilter"]').checked = app.settings.textureDisableFilter === "on";
    document.querySelector('input[name="queuedPaint"]').checked = app.settings.queuedPaint === "on";

    const appPropsTextarea = document.getElementById("editAppProps");
    appPropsTextarea.value = Object.entries(app.appProperties || {})
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");

    const sysPropsTextarea = document.getElementById("editSysProps");
    sysPropsTextarea.value = Object.entries(app.systemProperties || {})
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");

    document.getElementById("add-save-button").disabled = false;
    document.getElementById("add-save-button").textContent = isAdding ? "Add game" : "Save game";
    document.getElementById("add-save-button").onclick = doAddSaveGame;
}

function adjustScreenSizeInput() {
    document.getElementById("edit-custom-size-inputs").style.display =
        document.getElementById("screenSize").value === "custom" ? "" : "none";
}

function handleOptionalJadFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById("add-manage-step").style.display = "none";
    document.getElementById("file-input-loading").style.display = "";

    // read as text?
    const reader = new FileReader();
    reader.onload = async () => {
        // this won't affect the name/id
        readToKv(reader.result, state.currentGame.appProperties);

        const appPropsTextarea = document.getElementById("editAppProps");
        appPropsTextarea.value = Object.entries(
            state.currentGame.appProperties || {}
        )
            .map(([key, value]) => `${key}: ${value}`)
            .join("\n");
    };
    reader.onloadend = () => {
        document.getElementById("add-manage-step").style.display = "";
        document.getElementById("file-input-loading").style.display = "none";
    };
    reader.readAsText(file);
}

async function doAddSaveGame() {
    const saveBtn = document.getElementById("add-save-button");
    const isAdding = !!state.currentGame.jarFile;
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `
            <svg class="w-4 h-4 animate-spin text-white inline-block mr-1.5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Saving Game...</span>
        `;
    }

    try {
        readUI(state.currentGame);

        const jsettings = await kvToJava(state.currentGame.settings);
        const jappProps = await kvToJava(state.currentGame.appProperties);
        const jsysProps = await kvToJava(state.currentGame.systemProperties);

        if (state.currentGame.jarFile) {
            // new game
            await launcherUtil.initApp(
                state.currentGame.jarFile,
                state.lastLoader, // loader with added properties, for name..
                jsettings,
                jappProps,
                jsysProps
            );
        } else {
            await launcherUtil.saveApp(
                state.currentGame.appId,
                jsettings,
                jappProps,
                jsysProps
            );
        }

        await reloadUI();
    } catch (err) {
        console.error("Failed to save game:", err);
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = isAdding ? "Add game" : "Save game";
        }
        alert("Error saving game: " + getErrorMessage(err));
    }
}

function readUI(targetGameObj) {
    targetGameObj.settings.phone = document.getElementById("phoneType").value;

    const screenSize = document.getElementById("screenSize").value;
    if (screenSize === "custom") {
        targetGameObj.settings.width = document.getElementById("customWidth").value;
        targetGameObj.settings.height = document.getElementById("customHeight").value;
    } else {
        const [width, height] = screenSize.split("x");
        targetGameObj.settings.width = width;
        targetGameObj.settings.height = height;
    }

    targetGameObj.settings.fontSize = document.getElementById("fontSize").value;
    targetGameObj.settings.dgFormat = document.getElementById("dgFormat").value;

    targetGameObj.settings.sound = document.querySelector('input[name="enableSound"]').checked ? "on" : "off";
    targetGameObj.settings.rotate = document.querySelector('input[name="rotate"]').checked ? "on" : "off";
    targetGameObj.settings.forceFullscreen = document.querySelector('input[name="forceFullscreen"]').checked ? "on" : "off";
    targetGameObj.settings.textureDisableFilter = document.querySelector('input[name="textureDisableFilter"]').checked ? "on" : "off";
    targetGameObj.settings.queuedPaint = document.querySelector('input[name="queuedPaint"]').checked ? "on" : "off";

    readToKv(document.getElementById("editAppProps").value, targetGameObj.appProperties);
    readToKv(document.getElementById("editSysProps").value, targetGameObj.systemProperties);
}

function openEditGame(gameObj) {
    if (!confirmDiscard()) {
        return;
    }
    state.currentGame = gameObj;
    document.getElementById("add-edit-text").textContent = "Edit Game: " + (gameObj.name || gameObj.appId);

    setupAddManageGame(gameObj, false);
    document.getElementById("add-edit-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function confirmDiscard() {
    if (state.currentGame != null && state.currentGame.jarFile) {
        if (!confirm("Discard unsaved game upload?")) {
            return false;
        }
    }

    return true;
}

async function handleDirectUrlInstall(url) {
    const input = document.getElementById("game-url-input");
    const btn = document.getElementById("download-url-btn");
    const origBtnHtml = btn ? btn.innerHTML : "";
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin inline mr-1" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> <span>Downloading...</span>`;
    }

    try {
        const rawFilename = url.split('/').pop().split('?')[0] || "game.jar";
        const buf = await fetchJarBuffer(url);
        if (btn) btn.innerHTML = `<span>Installing...</span>`;
        await installJarFromBuffer(buf, rawFilename);
        if (input) input.value = "";
        await reloadUI();
        alert("Game downloaded and installed successfully! Click Play to start.");
    } catch (err) {
        console.error("Failed to install game from URL:", err);
        alert(`Failed to download game from:\n${url}\n\n${getErrorMessage(err)}\n\nPlease ensure the URL is active and points directly to a valid .jar file.`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origBtnHtml;
        }
    }
}

async function reloadUI(statusUpdater = null) {
    state.currentGame = null;

    state.games = await loadGames(statusUpdater);
    fillGamesList(state.games);
    setupAddMode();
}

async function doUninstallGame(appId) {
    await launcherUtil.uninstallApp(appId);
    await reloadUI();
}

async function doWipeData(appId) {
    await launcherUtil.wipeAppData(appId);
    document.getElementById("wipe-data-btn").disabled = false;
}

function doImportData(e) {
    if (e.target.files.length > 0) {
        document.getElementById("import-data-btn").disabled = true;

        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const arrayBuffer = reader.result;
                await launcherUtil.importData(new Int8Array(arrayBuffer));
                await reloadUI();
            } catch (error) {
                console.error("Error importing data:", error);
            }
        };
        reader.onloadend = () => {
            document.getElementById("import-data-btn").disabled = false;
        };
        reader.readAsArrayBuffer(file);
    }
}

async function syncKeypadLayoutsToFiles() {
    if (window.cheerpjAddStringFile) {
        if (state && state.games) {
            for (const game of state.games) {
                const appId = game.appId;
                const kbdKey = `j2me_kbd_layout_${appId}`;
                const kbdData = localStorage.getItem(kbdKey);
                if (kbdData) {
                    try {
                        window.cheerpjAddStringFile(`/files/${appId}/config/keypad_layout.json`, kbdData);
                    } catch(e) {}
                }
            }
        }
        const desktopMap = localStorage.getItem('j2me_desktop_key_map');
        if (desktopMap) {
            try {
                window.cheerpjAddStringFile('/files/desktop_key_map.json', desktopMap);
            } catch(e) {}
        }
    }
}

async function doExportData() {
    try {
        await syncKeypadLayoutsToFiles();
        const exportedData = await launcherUtil.exportData();
        const blob = new Blob([exportedData.buffer], { type: "application/zip" });

        const objectURL = URL.createObjectURL(blob);
        const downloadLink = document.getElementById("export-data-link");

        downloadLink.href = objectURL;
        downloadLink.click();
        setTimeout(() => URL.revokeObjectURL(objectURL), 1000);
    } catch (error) {
        console.error("Error exporting data:", error);
        alert("Error exporting data");
    }
}

main();
