/*
 * Game Configuration Manager & Edit Game Popup Modal
 * Allows editing device profile, screen size, sound, rotation, and properties
 * during gameplay or from the run page.
 */

const defaultSettings = {
    phone: "Standard",
    width: "240",
    height: "320",
    fontSize: "0",
    dgFormat: "565",
    sound: "on",
    rotate: "off",
    forceFullscreen: "off",
    textureDisableFilter: "off",
    queuedPaint: "off"
};

function readToKv(txt, kv) {
    if (!txt) return;
    for (const line of txt.trim().split("\n")) {
        const parts = line.split(/\s*:\s*/);
        if (parts.length === 2) {
            kv[parts[0]] = parts[1];
        }
    }
}

async function kvToJava(lib, kv) {
    if (!lib || !lib.java) return null;
    const HashMap = await lib.java.util.HashMap;
    const ret = await new HashMap();
    for (const k of Object.keys(kv)) {
        await ret.put(k, kv[k]);
    }
    return ret;
}

export function createEditGameModalDOM() {
    let modal = document.getElementById('edit-game-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'edit-game-modal';
    modal.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md hidden transition-all duration-200 pointer-events-auto';
    modal.innerHTML = `
        <div id="edit-game-modal-card" class="bg-white text-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 border border-cyan-100 pointer-events-auto select-text">
            <!-- Modal Header -->
            <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div class="flex items-center gap-3.5 min-w-0">
                    <div class="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-200 p-1 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                        <img id="edit-game-modal-icon" class="w-full h-full object-contain" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%230891b2' stroke-width='2'><path stroke-linecap='round' stroke-linejoin='round' d='M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z'/></svg>" alt="Game Icon" />
                    </div>
                    <div class="min-w-0 flex-1">
                        <h2 id="edit-game-modal-name" class="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">Edit Game Settings</h2>
                        <p id="edit-game-modal-sub" class="text-xs text-slate-500 font-mono truncate">Configure phone profile, resolution, audio & properties</p>
                    </div>
                </div>
                <button id="edit-modal-close-icon" type="button" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>

            <!-- Modal Body -->
            <div class="p-5 overflow-y-auto space-y-5 custom-scrollbar flex-1 max-h-[65vh]">
                
                <!-- Phone Profile & Screen Size -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="space-y-1.5">
                        <label for="popup-phoneType" class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Phone Device Profile</label>
                        <select id="popup-phoneType" class="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer">
                            <option value="Standard">Standard J2ME Device</option>
                            <option value="Nokia">Nokia Series 40 / 60</option>
                            <option value="Motorola">Motorola E398 / V3</option>
                            <option value="Siemens">Siemens M65 / CX65</option>
                            <option value="SonyEricsson">Sony Ericsson K750i / W800i</option>
                        </select>
                    </div>

                    <div class="space-y-1.5">
                        <label for="popup-screenSize" class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Screen Resolution</label>
                        <select id="popup-screenSize" class="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer">
                            <option value="96x65">96x65 (Nokia 3310)</option>
                            <option value="96x96">96x96 (Square classic)</option>
                            <option value="128x128">128x128 (Nokia S40 v1)</option>
                            <option value="128x160">128x160 (Standard color phone)</option>
                            <option value="176x208">176x208 (Nokia Symbian v1/v2)</option>
                            <option value="176x220">176x220 (Motorola / Sony Ericsson)</option>
                            <option value="208x208">208x208 (Square Symbian)</option>
                            <option value="240x320">240x320 (QVGA Standard - Recommended)</option>
                            <option value="320x240">320x240 (Landscape QVGA)</option>
                            <option value="240x400">240x400 (WQVGA Touchscreen)</option>
                            <option value="352x416">352x416 (Nokia N80 High-res)</option>
                            <option value="360x640">360x640 (Symbian Touch 5800)</option>
                            <option value="480x800">480x800 (WVGA Touch)</option>
                            <option value="custom">Custom Size...</option>
                        </select>
                        <div id="popup-custom-size" class="flex gap-2 mt-2 hidden">
                            <input type="number" id="popup-customWidth" placeholder="Width (px)" min="1" class="w-1/2 text-xs bg-slate-50 border border-slate-200 rounded-xl p-2" />
                            <input type="number" id="popup-customHeight" placeholder="Height (px)" min="1" class="w-1/2 text-xs bg-slate-50 border border-slate-200 rounded-xl p-2" />
                        </div>
                    </div>

                    <div class="space-y-1.5">
                        <label for="popup-fontSize" class="block text-xs font-bold text-slate-700 uppercase tracking-wider">System Font Size</label>
                        <select id="popup-fontSize" class="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer">
                            <option value="0">Dynamic / Auto</option>
                            <option value="1">Small Font</option>
                            <option value="2">Medium Font</option>
                            <option value="3">Large Font</option>
                        </select>
                    </div>

                    <div class="space-y-1.5">
                        <label for="popup-dgFormat" class="block text-xs font-bold text-slate-700 uppercase tracking-wider">DirectGraphics Format</label>
                        <select id="popup-dgFormat" class="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer">
                            <option value="444">444 RGB</option>
                            <option value="4444">4444 ARGB</option>
                            <option value="565">565 RGB (Standard)</option>
                            <option value="888">888 RGB</option>
                            <option value="8888">8888 ARGB</option>
                        </select>
                    </div>
                </div>

                <!-- Toggles -->
                <div class="pt-3 border-t border-slate-100">
                    <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">Runtime Enhancements</label>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-medium text-slate-700">
                        <label class="flex items-center gap-2 p-2 bg-slate-50 hover:bg-cyan-50/50 rounded-xl border border-slate-200 cursor-pointer">
                            <input type="checkbox" id="popup-enableSound" class="w-4 h-4 text-cyan-600 rounded border-slate-300 cursor-pointer" checked />
                            <span>Enable Sound Synthesizer</span>
                        </label>
                        <label class="flex items-center gap-2 p-2 bg-slate-50 hover:bg-cyan-50/50 rounded-xl border border-slate-200 cursor-pointer">
                            <input type="checkbox" id="popup-rotate" class="w-4 h-4 text-cyan-600 rounded border-slate-300 cursor-pointer" />
                            <span>Rotate Screen 90°</span>
                        </label>
                        <label class="flex items-center gap-2 p-2 bg-slate-50 hover:bg-cyan-50/50 rounded-xl border border-slate-200 cursor-pointer">
                            <input type="checkbox" id="popup-forceFullscreen" class="w-4 h-4 text-cyan-600 rounded border-slate-300 cursor-pointer" />
                            <span>Force Fullscreen View</span>
                        </label>
                        <label class="flex items-center gap-2 p-2 bg-slate-50 hover:bg-cyan-50/50 rounded-xl border border-slate-200 cursor-pointer">
                            <input type="checkbox" id="popup-textureDisableFilter" class="w-4 h-4 text-cyan-600 rounded border-slate-300 cursor-pointer" />
                            <span>Crisp Pixel Art (Disable Filter)</span>
                        </label>
                        <label class="flex items-center gap-2 p-2 bg-slate-50 hover:bg-cyan-50/50 rounded-xl border border-slate-200 cursor-pointer sm:col-span-2">
                            <input type="checkbox" id="popup-queuedPaint" class="w-4 h-4 text-cyan-600 rounded border-slate-300 cursor-pointer" />
                            <span>Queue Paint Events (Fix Freeze)</span>
                        </label>
                    </div>
                </div>

                <!-- Advanced Properties Accordion -->
                <details class="group pt-2">
                    <summary class="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider cursor-pointer select-none py-2 border-t border-slate-100">
                        <span>Advanced Properties (key: value)</span>
                        <svg class="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    </summary>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div class="space-y-1">
                            <label for="popup-appProps" class="block text-[11px] font-semibold text-slate-600">App Properties</label>
                            <textarea id="popup-appProps" placeholder="MIDlet-Vendor: Gameloft" class="w-full h-20 p-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"></textarea>
                        </div>
                        <div class="space-y-1">
                            <label for="popup-sysProps" class="block text-[11px] font-semibold text-slate-600">System Properties</label>
                            <textarea id="popup-sysProps" placeholder="microedition.platform: Nokia6600" class="w-full h-20 p-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"></textarea>
                        </div>
                    </div>
                </details>
            </div>

            <!-- Modal Footer -->
            <div class="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3">
                <button id="edit-modal-cancel-btn" type="button" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer">
                    Cancel
                </button>
                <button id="edit-modal-save-btn" type="button" class="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-extrabold rounded-xl shadow-md shadow-cyan-600/20 transition-all flex items-center gap-1.5 cursor-pointer">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    <span>Save & Apply Settings</span>
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {
        modal.classList.add('hidden');
        if (window.resumeGameRuntime) {
            window.resumeGameRuntime();
        }
    };
    document.getElementById('edit-modal-close-icon').onclick = closeModal;
    document.getElementById('edit-modal-cancel-btn').onclick = closeModal;

    document.getElementById('popup-screenSize').onchange = (e) => {
        document.getElementById('popup-custom-size').classList.toggle('hidden', e.target.value !== 'custom');
    };

    // Only prevent key events inside modal from propagating to canvas game (allow standard mouse/touch events on dropdowns)
    const modalCard = modal.querySelector('#edit-game-modal-card');
    if (modalCard) {
        ['keydown', 'keyup', 'keypress'].forEach(evtName => {
            modalCard.addEventListener(evtName, (e) => {
                e.stopPropagation();
            });
        });
    }

    return modal;
}

export async function openEditGameModal(appId) {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }

    if (window.pauseGameRuntime) {
        window.pauseGameRuntime();
    }

    const modal = createEditGameModalDOM();

    let gameName = appId || 'Current Game';
    let gameIcon = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%230891b2' stroke-width='2'><path stroke-linecap='round' stroke-linejoin='round' d='M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z'/></svg>";

    const getBlob = window.cjFileBlob || (typeof cjFileBlob !== 'undefined' ? cjFileBlob : null);

    if (getBlob && appId) {
        try {
            const nameBlob = await getBlob(`/files/${appId}/name`);
            if (nameBlob) {
                const txt = (await nameBlob.text()).trim();
                if (txt) gameName = txt;
            }
        } catch (e) {}

        try {
            const iconBlob = await getBlob(`/files/${appId}/icon`);
            if (iconBlob && iconBlob.size > 0) {
                const reader = new FileReader();
                gameIcon = await new Promise((resolve) => {
                    reader.onload = (e) => resolve(e.target.result || gameIcon);
                    reader.onerror = () => resolve(gameIcon);
                    reader.readAsDataURL(iconBlob);
                });
            }
        } catch (e) {}
    }

    const nameEl = document.getElementById('edit-game-modal-name');
    if (nameEl) nameEl.textContent = gameName;

    const iconEl = document.getElementById('edit-game-modal-icon');
    if (iconEl) iconEl.src = gameIcon;

    const subEl = document.getElementById('edit-game-modal-sub');
    if (subEl) subEl.textContent = `App ID: ${appId || 'Current Game'}`;

    const currentSettings = { ...defaultSettings };
    const appProps = {};
    const sysProps = {};

    try {
        if (getBlob && appId) {
            const settingsBlob = await getBlob(`/files/${appId}/config/settings.conf`);
            if (settingsBlob) {
                readToKv(await settingsBlob.text(), currentSettings);
            }
            const appPropsBlob = await getBlob(`/files/${appId}/config/appproperties.conf`);
            if (appPropsBlob) {
                readToKv(await appPropsBlob.text(), appProps);
            }
            const sysPropsBlob = await getBlob(`/files/${appId}/config/systemproperties.conf`);
            if (sysPropsBlob) {
                readToKv(await sysPropsBlob.text(), sysProps);
            }
        }
    } catch (e) {
        console.warn("Error reading game config files:", e);
    }

    // Populate form
    const phoneSelect = document.getElementById('popup-phoneType');
    if (phoneSelect) phoneSelect.value = currentSettings.phone || 'Standard';

    const sizeStr = `${currentSettings.width}x${currentSettings.height}`;
    const screenSizeSelect = document.getElementById('popup-screenSize');
    if (screenSizeSelect) {
        if ([...screenSizeSelect.options].some(o => o.value === sizeStr)) {
            screenSizeSelect.value = sizeStr;
            document.getElementById('popup-custom-size').classList.add('hidden');
        } else {
            screenSizeSelect.value = 'custom';
            document.getElementById('popup-custom-size').classList.remove('hidden');
        }
    }
    const widthInput = document.getElementById('popup-customWidth');
    if (widthInput) widthInput.value = currentSettings.width || '240';
    const heightInput = document.getElementById('popup-customHeight');
    if (heightInput) heightInput.value = currentSettings.height || '320';

    const fontSizeSelect = document.getElementById('popup-fontSize');
    if (fontSizeSelect) fontSizeSelect.value = currentSettings.fontSize || '0';
    const dgFormatSelect = document.getElementById('popup-dgFormat');
    if (dgFormatSelect) dgFormatSelect.value = currentSettings.dgFormat || '565';

    const soundCb = document.getElementById('popup-enableSound');
    if (soundCb) soundCb.checked = currentSettings.sound !== 'off';
    const rotateCb = document.getElementById('popup-rotate');
    if (rotateCb) rotateCb.checked = currentSettings.rotate === 'on';
    const fsCb = document.getElementById('popup-forceFullscreen');
    if (fsCb) fsCb.checked = currentSettings.forceFullscreen === 'on';
    const texCb = document.getElementById('popup-textureDisableFilter');
    if (texCb) texCb.checked = currentSettings.textureDisableFilter === 'on';
    const qpCb = document.getElementById('popup-queuedPaint');
    if (qpCb) qpCb.checked = currentSettings.queuedPaint === 'on';

    const appPropsTa = document.getElementById('popup-appProps');
    if (appPropsTa) appPropsTa.value = Object.entries(appProps).map(([k, v]) => `${k}: ${v}`).join('\n');
    const sysPropsTa = document.getElementById('popup-sysProps');
    if (sysPropsTa) sysPropsTa.value = Object.entries(sysProps).map(([k, v]) => `${k}: ${v}`).join('\n');

    modal.classList.remove('hidden');
    setTimeout(() => {
        if (phoneSelect) phoneSelect.focus();
    }, 50);

    document.getElementById('edit-modal-save-btn').onclick = async () => {
        const saveBtn = document.getElementById('edit-modal-save-btn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = `
                <svg class="w-4 h-4 animate-spin text-white inline-block mr-1.5" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Applying Settings...</span>
            `;
        }

        // Read form values
        currentSettings.phone = document.getElementById('popup-phoneType').value;
        const selSize = document.getElementById('popup-screenSize').value;
        if (selSize === 'custom') {
            currentSettings.width = document.getElementById('popup-customWidth').value || '240';
            currentSettings.height = document.getElementById('popup-customHeight').value || '320';
        } else {
            const [w, h] = selSize.split('x');
            currentSettings.width = w;
            currentSettings.height = h;
        }

        currentSettings.fontSize = document.getElementById('popup-fontSize').value;
        currentSettings.dgFormat = document.getElementById('popup-dgFormat').value;

        currentSettings.sound = document.getElementById('popup-enableSound').checked ? 'on' : 'off';
        currentSettings.rotate = document.getElementById('popup-rotate').checked ? 'on' : 'off';
        currentSettings.forceFullscreen = document.getElementById('popup-forceFullscreen').checked ? 'on' : 'off';
        currentSettings.textureDisableFilter = document.getElementById('popup-textureDisableFilter').checked ? 'on' : 'off';
        currentSettings.queuedPaint = document.getElementById('popup-queuedPaint').checked ? 'on' : 'off';

        const updatedAppProps = {};
        readToKv(document.getElementById('popup-appProps').value, updatedAppProps);
        const updatedSysProps = {};
        readToKv(document.getElementById('popup-sysProps').value, updatedSysProps);

        try {
            let lib = window.cheerpjLib;
            let launcherUtil = window.launcherUtil;
            if (!launcherUtil && window.cheerpjRunLibrary && appId) {
                lib = await window.cheerpjRunLibrary(window.cheerpjWebRoot ? window.cheerpjWebRoot + "/j2me-web-loader.jar" : "/app/j2me-web-loader.jar");
                if (lib && lib.pl) {
                    launcherUtil = await lib.pl.zb3.freej2me.launcher.LauncherUtil;
                }
            }

            if (launcherUtil && lib) {
                const jsettings = await kvToJava(lib, currentSettings);
                const jappProps = await kvToJava(lib, updatedAppProps);
                const jsysProps = await kvToJava(lib, updatedSysProps);

                if (jsettings && jappProps && jsysProps) {
                    await launcherUtil.saveApp(appId, jsettings, jappProps, jsysProps);
                }
            }
        } catch (e) {
            console.warn("Could not save via Java LauncherUtil:", e);
        }

        modal.classList.add('hidden');
        location.reload();
    };
}
