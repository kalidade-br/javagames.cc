import { LibMedia } from "../libmedia/libmedia.js";
import { LibMidi, createUnlockingAudioContext } from "../libmidi/libmidi.js";
import { codeMap, KeyRepeatManager } from "./key.js";
import { EventQueue } from "./eventqueue.js";
import { initKbdListeners, setKbdHandler, kbdWidth, kbdHeight } from "./screenKbd.js";
import { initLayoutManager, toggleLayoutEditMode } from "./layoutManager.js";
import { getMappedTarget, getCustomCodeForTarget, openDesktopControlsModal } from "./desktopKeyManager.js";
import { openEditGameModal } from "./gameConfigManager.js";

// we need to import natives here, don't use System.loadLibrary
// since CheerpJ fails to load them in firefox and we can't set breakpoints
import canvasFontNatives from "../libjs/libcanvasfont.js";
import canvasGraphicsNatives from "../libjs/libcanvasgraphics.js";
import gles2Natives from "../libjs/libgles2.js";
import jsReferenceNatives from "../libjs/libjsreference.js";
import mediaBridgeNatives from "../libjs/libmediabridge.js";
import midiBridgeNatives from "../libjs/libmidibridge.js";

const evtQueue = new EventQueue();
const sp = new URLSearchParams(location.search);

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
window.cheerpjWebRoot = cheerpjWebRoot;

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

// Detect if mobile mode is requested or touch screen / small screen
let isMobileMode = (sp.get('mobile') === '1' || sp.get('mobile') === 'true') || ('ontouchstart' in window) || (window.innerWidth <= 768);

let display = null;
let screenCtx = null;

let fractionScale = sp.get('fractionScale') || (localStorage && localStorage.getItem("pl.zb3.freej2me.fractionScale") === "true");
let scaleSet = false;

const keyRepeatManager = new KeyRepeatManager();

window.evtQueue = evtQueue;

function updateKeypadButtonUI() {
    const toggleKbdBtn = document.getElementById('toggle-kbd-btn');
    const kbdLabel = document.getElementById('kbd-btn-label');
    const isKbdActive = document.body.classList.contains('kbd-portrait') || document.body.classList.contains('kbd-landscape');

    if (kbdLabel) {
        kbdLabel.textContent = isKbdActive ? 'Keypad: ON' : 'Keypad: OFF';
    }
}

function autoscale() {
    if (!scaleSet || !screenCtx || !screenCtx.canvas) return;

    let screenWidth = window.innerWidth;
    let screenHeight = window.innerHeight;

    const isKbdActive = document.body.classList.contains('kbd-portrait') || document.body.classList.contains('kbd-landscape');

    if (isKbdActive) {
        const leftKeys = document.getElementById('left-keys');
        const rightKeys = document.getElementById('right-keys');
        if (leftKeys) leftKeys.style.display = '';
        if (rightKeys) rightKeys.style.display = '';

        if (screenWidth > screenHeight) {
            document.body.classList.add('kbd-landscape');
            document.body.classList.remove('kbd-portrait');
            screenWidth = Math.max(100, screenWidth - 2 * kbdWidth);
        } else {
            document.body.classList.add('kbd-portrait');
            document.body.classList.remove('kbd-landscape');
            screenHeight = Math.max(100, screenHeight - kbdHeight);
        }
    } else {
        const leftKeys = document.getElementById('left-keys');
        const rightKeys = document.getElementById('right-keys');
        if (leftKeys) leftKeys.style.display = 'none';
        if (rightKeys) rightKeys.style.display = 'none';
    }

    let scale = Math.min(
        screenWidth / screenCtx.canvas.width,
        screenHeight / screenCtx.canvas.height
    );

    if (!fractionScale) {
        scale = Math.max(1, scale | 0);
    }

    if (display) {
        display.style.zoom = scale;
    }

    updateKeypadButtonUI();
}

function setListeners() {
    let mouseDown = false;
    let noMouse = false;

    setKbdHandler((isDown, key) => {
        const symbol = key.startsWith('Digit') ? key.substring(5) : '\x00';
        keyRepeatManager.post(isDown, key, {symbol, ctrlKey: false, shiftKey: false});
    });

    function handleKeyEvent(e) {
        const isDown = e.type === 'keydown';

        const mapped = getMappedTarget(e.code);
        if (mapped) {
            keyRepeatManager.post(isDown, mapped.targetKey, {
                symbol: e.key.length == 1 ? e.key.charCodeAt(0) : '\x00',
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey
            });
        } else if (codeMap[e.code]) {
            keyRepeatManager.post(isDown, e.code, {
                symbol: e.key.length == 1 ? e.key.charCodeAt(0) : '\x00',
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey
            });
        }
        e.preventDefault();
    }

    display.addEventListener('keydown', handleKeyEvent);
    display.addEventListener('keyup', handleKeyEvent);

    keyRepeatManager.register((kind, key, args) => {
        if (kind === 'click') {
            if (key === 'Maximize') {
                fractionScale = !fractionScale;
                localStorage && localStorage.setItem("pl.zb3.freej2me.fractionScale", fractionScale);
                autoscale();
            }
        } else {
            const customCode = getCustomCodeForTarget(key);
            const finalCode = customCode !== null ? customCode : codeMap[key];
            if (finalCode !== undefined) {
                evtQueue.queueEvent({
                    kind: kind === 'up' ? 'keyup' : 'keydown',
                    args: [finalCode, args.symbol, args.ctrlKey, args.shiftKey]
                });
            }
        }
    });

    display.addEventListener('mousedown', async e => {
        display.focus();
        if (noMouse) return;

        evtQueue.queueEvent({
            kind: 'pointerpressed',
            x: e.offsetX / display.currentCSSZoom | 0,
            y: e.offsetY / display.currentCSSZoom | 0,
        });

        mouseDown = true;

        e.preventDefault();
    });

    display.addEventListener('mousemove', async e => {
        if (noMouse) return;
        if (!mouseDown) return;

        evtQueue.queueEvent({
            kind: 'pointerdragged',
            x: e.offsetX / display.currentCSSZoom | 0,
            y: e.offsetY / display.currentCSSZoom | 0,
        });

        e.preventDefault();
    });

    document.addEventListener('mouseup', async e => {
        if (noMouse) return;
        if (!mouseDown) return;

        mouseDown = false;

        evtQueue.queueEvent({
            kind: 'pointerreleased',
            x: (e.pageX - display.offsetLeft) / display.currentCSSZoom | 0,
            y: (e.pageY - display.offsetTop) / display.currentCSSZoom | 0,
        });

        e.preventDefault();
    });


    display.addEventListener('touchstart', async e => {
        display.focus();
        noMouse = true;

        evtQueue.queueEvent({
            kind: 'pointerpressed',
            x: (e.changedTouches[0].pageX - display.offsetLeft) / display.currentCSSZoom | 0,
            y: (e.changedTouches[0].pageY - display.offsetTop) / display.currentCSSZoom | 0,
        });

        e.preventDefault();
    }, {passive: false});

    display.addEventListener('touchmove', async e => {
        noMouse = true;

        evtQueue.queueEvent({
            kind: 'pointerdragged',
            x: (e.changedTouches[0].pageX - display.offsetLeft) / display.currentCSSZoom | 0,
            y: (e.changedTouches[0].pageY - display.offsetTop) / display.currentCSSZoom | 0,
        });

        e.preventDefault();
    }, {passive: false});

    display.addEventListener('touchend', async e => {
        noMouse = true;

        evtQueue.queueEvent({
            kind: 'pointerreleased',
            x: (e.changedTouches[0].pageX - display.offsetLeft) / display.currentCSSZoom | 0,
            y: (e.changedTouches[0].pageY - display.offsetTop) / display.currentCSSZoom | 0,
        });

        e.preventDefault();
    });

    document.addEventListener('mousedown', e => {
        console.log('refocus');
        setTimeout(() => display.focus(), 20);
        ;
    });

    display.addEventListener('blur', e => {
        console.log('refocus');
        // it doesn't work without any timeout
        setTimeout(() => display.focus(), 10);
        ;
    });

    window.addEventListener('resize', autoscale);

    // Initial Mobile vs Desktop Setup
    const desktopKeysBtn = document.getElementById('desktop-keys-btn');
    if (desktopKeysBtn) {
        desktopKeysBtn.style.display = isMobileMode ? 'none' : 'inline-flex';
    }

    // Keep keypad off during loading screen
    document.body.classList.remove('kbd-portrait', 'kbd-landscape');
    updateKeypadButtonUI();

    // 1. Keypad Toggle Button
    const toggleKbdBtn = document.getElementById('toggle-kbd-btn');
    if (toggleKbdBtn) {
        toggleKbdBtn.onclick = () => {
            const isKbdActive = document.body.classList.contains('kbd-portrait') || document.body.classList.contains('kbd-landscape');
            if (isKbdActive) {
                document.body.classList.remove('kbd-portrait', 'kbd-landscape');
            } else {
                if (window.innerWidth > window.innerHeight) {
                    document.body.classList.add('kbd-landscape');
                } else {
                    document.body.classList.add('kbd-portrait');
                }
            }
            updateKeypadButtonUI();
            autoscale();
        };
    }

    // 2. Customize Keyboard Button
    const editKbdBtn = document.getElementById('edit-kbd-btn');
    if (editKbdBtn) {
        editKbdBtn.onclick = () => {
            const isKbdActive = document.body.classList.contains('kbd-portrait') || document.body.classList.contains('kbd-landscape');
            if (!isKbdActive) {
                if (window.innerWidth > window.innerHeight) {
                    document.body.classList.add('kbd-landscape');
                } else {
                    document.body.classList.add('kbd-portrait');
                }
                updateKeypadButtonUI();
                autoscale();
            }
            toggleLayoutEditMode(true, autoscale);
        };
    }

    // 3. Desktop Controls Button
    if (desktopKeysBtn) {
        desktopKeysBtn.onclick = () => {
            openDesktopControlsModal();
        };
    }

    // 4. Edit Game Settings Button
    const editGameBtn = document.getElementById('edit-game-btn');
    if (editGameBtn) {
        editGameBtn.onclick = () => {
            const appId = sp.get('app');
            openEditGameModal(appId);
        };
    }

    // 5. Fullscreen Toggle Button & Listener
    const fsToggleBtn = document.getElementById('fullscreen-toggle-btn');
    if (fsToggleBtn) {
        fsToggleBtn.onclick = () => {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                document.documentElement.requestFullscreen().catch(err => {
                    console.warn("Fullscreen error:", err);
                });
            }
        };
    }

    // Global Pause and Resume functions for modals (e.g. Edit Game)
    window.pauseGameRuntime = function() {
        const canvas = document.getElementById('display');
        if (canvas) {
            canvas.style.pointerEvents = 'none';
            try { canvas.blur(); } catch(e){}
        }
        if (window.libmidi && window.libmidi.context && typeof window.libmidi.context.suspend === 'function') {
            try { window.libmidi.context.suspend().catch(()=>{}); } catch(e){}
        }
        document.querySelectorAll('audio, video').forEach(media => {
            try { media.pause(); } catch(e){}
        });
    };

    window.resumeGameRuntime = function() {
        const canvas = document.getElementById('display');
        if (canvas) {
            canvas.style.pointerEvents = 'auto';
        }
        if (window.libmidi && window.libmidi.context && typeof window.libmidi.context.resume === 'function') {
            try { window.libmidi.context.resume().catch(()=>{}); } catch(e){}
        }
    };

    const updateFullscreenUI = () => {
        const isFS = !!document.fullscreenElement;
        const standardControls = document.getElementById('standard-header-controls');
        const enterIcon = document.getElementById('fullscreen-enter-icon');
        const exitIcon = document.getElementById('fullscreen-exit-icon');
        const btnLabel = document.getElementById('fullscreen-btn-label');

        if (standardControls) {
            standardControls.style.display = isFS ? 'none' : 'flex';
        }
        if (enterIcon) enterIcon.classList.toggle('hidden', isFS);
        if (exitIcon) exitIcon.classList.toggle('hidden', !isFS);
        if (btnLabel) btnLabel.textContent = isFS ? 'Minimize' : 'Fullscreen';
    };

    document.addEventListener('fullscreenchange', updateFullscreenUI);

    initKbdListeners();
    initLayoutManager(autoscale);
    window.toggleLayoutEditMode = (enable) => toggleLayoutEditMode(enable, autoscale);
    window.openDesktopControlsModal = () => openDesktopControlsModal();
}

function setFaviconFromBuffer(arrayBuffer) {
    const blob = new Blob([arrayBuffer], { type: 'image/png' });

    const reader = new FileReader();
    reader.onload = function() {
        const dataURL = reader.result;

        let link = document.querySelector("link[rel*='icon']");
        if (!link) {
            link = document.createElement('link');
            link.setAttribute('rel', 'icon');
            document.head.appendChild(link);
        }
        link.setAttribute('href', dataURL);
    };
    reader.readAsDataURL(blob);
}

async function ensureAppInstalled(lib, appId) {
    const appFile = await cjFileBlob(appId + "/app.jar");

    if (!appFile) {
        const launcherUtil = await lib.pl.zb3.freej2me.launcher.LauncherUtil;

        await launcherUtil.installFromBundle(cheerpjWebRoot + "/apps/", appId);
    }
}

async function updateLoadingGameMetadata(appId) {
    if (!appId) return;

    const titleEl = document.getElementById("loading-game-title");
    const iconImg = document.getElementById("loading-game-icon");
    const fallbackIcon = document.getElementById("loading-fallback-icon");

    if (titleEl) {
        titleEl.textContent = appId;
    }

    try {
        if (window.cjFileBlob) {
            const nameBlob = await window.cjFileBlob("/files/" + appId + "/name");
            if (nameBlob) {
                const nameText = await nameBlob.text();
                if (nameText && nameText.trim() && titleEl) {
                    titleEl.textContent = nameText.trim();
                }
            }

            const iconBlob = await window.cjFileBlob("/files/" + appId + "/icon");
            if (iconBlob && iconBlob.size > 0) {
                const reader = new FileReader();
                reader.onload = () => {
                    if (iconImg && reader.result) {
                        iconImg.src = reader.result;
                        iconImg.classList.remove("hidden");
                        if (fallbackIcon) fallbackIcon.classList.add("hidden");
                    }
                };
                reader.readAsDataURL(iconBlob);
            }
        }
    } catch (e) {
        console.warn("Could not load game metadata for loader screen:", e);
    }
}

function updateLoadingStatus(msg) {
    const statusEl = document.getElementById("loading-status");
    if (statusEl) {
        statusEl.textContent = msg;
    } else {
        const loadingEl = document.getElementById("loading");
        if (loadingEl) loadingEl.textContent = msg;
    }
}

function hideLoading() {
    if (!scaleSet) return;

    const loadingEl = document.getElementById("loading");
    if (loadingEl) {
        loadingEl.style.setProperty('display', 'none', 'important');
        loadingEl.style.opacity = '0';
        loadingEl.style.visibility = 'hidden';
        loadingEl.hidden = true;
        loadingEl.classList.add("hidden", "is-hidden");
    }
    if (display) {
        display.style.display = '';
        try { display.focus(); } catch (e) {}
    }

    if (isMobileMode) {
        if (window.innerWidth > window.innerHeight) {
            document.body.classList.add('kbd-landscape');
            document.body.classList.remove('kbd-portrait');
        } else {
            document.body.classList.add('kbd-portrait');
            document.body.classList.remove('kbd-landscape');
        }
    } else {
        document.body.classList.remove('kbd-portrait', 'kbd-landscape');
    }

    updateKeypadButtonUI();
    autoscale();
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

async function init() {
    const currentApp = sp.get('app');
    const directUrl = sp.get('url') || (sp.get('jar') && /^https?:\/\//i.test(sp.get('jar')) ? sp.get('jar') : null);

    if (currentApp) {
        const titleEl = document.getElementById("loading-game-title");
        if (titleEl) titleEl.textContent = currentApp;
    } else if (directUrl) {
        const titleEl = document.getElementById("loading-game-title");
        const rawName = directUrl.split('/').pop().split('?')[0].replace(/\.jar$/i, '') || "Java Game";
        if (titleEl) titleEl.textContent = decodeURIComponent(rawName);
    }

    updateLoadingStatus("Initializing CheerpJ JVM...");

    display = document.getElementById('display');
    screenCtx = display.getContext('2d');

    setListeners();

    window.libmidi = new LibMidi(createUnlockingAudioContext());
    try {
        await window.libmidi.init();
    } catch (e) {
        console.warn("LibMidi init failed:", e);
    }
    if (window.libmidi.midiPlayer) {
        window.libmidi.midiPlayer.addEventListener('end-of-media', e => {
            window.evtQueue.queueEvent({kind: 'player-eom', player: e.target});
        });
    }
    window.libmedia = new LibMedia();

    await cheerpjInit({
        enableDebug: false,
        natives: {
            ...canvasFontNatives,
            ...canvasGraphicsNatives,
            ...gles2Natives,
            ...jsReferenceNatives,
            ...mediaBridgeNatives,
            ...midiBridgeNatives,
            async Java_pl_zb3_freej2me_bridge_shell_Shell_setTitle(lib, title) {
                document.title = title;
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_setIcon(lib, iconBytes) {
                if (iconBytes) {
                    setFaviconFromBuffer(iconBytes.buffer);
                }
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_getScreenCtx(lib) {
                return screenCtx;
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_setCanvasSize(lib, width, height) {
                screenCtx.canvas.width = width;
                screenCtx.canvas.height = height;
                scaleSet = true;
                autoscale();
                if (display) display.style.display = '';
                hideLoading();
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_waitForAndDispatchEvents(lib, listener) {
                if (scaleSet) {
                    hideLoading();
                }
                const KeyEvent = await lib.pl.zb3.freej2me.bridge.shell.KeyEvent;
                const PointerEvent = await lib.pl.zb3.freej2me.bridge.shell.PointerEvent;

                const evt = await evtQueue.waitForEvent();
                if (evt.kind == 'keydown') {
                    await listener.keyPressed(await new KeyEvent(...evt.args));
                } else if (evt.kind == 'keyup') {
                    await listener.keyReleased(await new KeyEvent(...evt.args));
                } else if (evt.kind == 'pointerpressed') {
                    await listener.pointerPressed(await new PointerEvent(evt.x, evt.y));
                } else if (evt.kind == 'pointerdragged') {
                    await listener.pointerDragged(await new PointerEvent(evt.x, evt.y));
                } else if (evt.kind == 'pointerreleased') {
                    await listener.pointerReleased(await new PointerEvent(evt.x, evt.y));
                } else if (evt.kind == 'player-eom') {
                    await listener.playerEOM(evt.player);
                } else if (evt.kind == 'player-video-frame') {
                    await listener.playerVideoFrame(evt.player);
                }
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_restart(lib) {
                location.reload();
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_exit(lib) {
                location.href = './';
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_sthop(lib) {
                debugger;
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_say(lib, sth) {
                console.log('[say]', sth);
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_sayObject(lib, label, obj) {
                debugger;
                console.log('[sayobject]', label, obj);
            }
        }
    });

    if (currentApp) {
        updateLoadingGameMetadata(currentApp);
    }

    updateLoadingStatus("Starting Java game runtime...");

    const lib = await cheerpjRunLibrary(cheerpjWebRoot+"/j2me-web-loader.jar");
    window.cheerpjLib = lib;
    if (lib && lib.pl && lib.pl.zb3) {
        try {
            window.launcherUtil = await lib.pl.zb3.freej2me.launcher.LauncherUtil;
        } catch (e) {}
    }

    const FreeJ2ME = await lib.org.recompile.freej2me.FreeJ2ME;

    let args;

    if (sp.get('app')) {
        const app = sp.get('app');
        await ensureAppInstalled(lib, app);

        args = ['app', sp.get('app')];
    } else if (directUrl) {
        updateLoadingStatus("Downloading game from link...");
        try {
            const buf = await fetchJarBuffer(directUrl);
            updateLoadingStatus("Launching game...");
            const File = await lib.java.io.File;
            const tmpJarFile = await new File("/files/_tmp/remote_launch.jar");
            const launcherUtil = await lib.pl.zb3.freej2me.launcher.LauncherUtil;
            await launcherUtil.copyJar(new Int8Array(buf), tmpJarFile);
            args = ['jar', '/files/_tmp/remote_launch.jar'];
        } catch (err) {
            console.error("Failed to load direct JAR:", err);
            updateLoadingStatus("Download failed: " + getErrorMessage(err));
            throw err;
        }
    } else {
        args = ['jar', cheerpjWebRoot+"/jar/" + (sp.get('jar') || "game.jar")];
    }

    FreeJ2ME.main(args).catch(e => {
        e.printStackTrace();
        updateLoadingStatus('Crash :(');
    });

    // Fallback safety if setCanvasSize isn't called after 8 seconds
    setTimeout(() => {
        if (!scaleSet && display && screenCtx) {
            screenCtx.canvas.width = screenCtx.canvas.width || 240;
            screenCtx.canvas.height = screenCtx.canvas.height || 320;
            scaleSet = true;
            autoscale();
            hideLoading();
        }
    }, 8000);
}

init().catch(err => {
    console.error("Failed to initialize game runner:", err);
    updateLoadingStatus("Failed to load game: " + getErrorMessage(err));
});