/*
 * Desktop Keyboard Mapping Manager
 * Manages custom key bindings, key codes, localStorage persistence,
 * and the Desktop Key Customizer Modal UI.
 */

export const STORAGE_KEY_DESKTOP_KEYS = 'j2me_desktop_keymap_v1';

export const DEFAULT_KEY_BINDINGS = [
    { id: 'Pause', label: 'Options / Pause', defaultTarget: 'Escape', targetCode: 27, keys: ['Escape'] },
    { id: 'LeftSoft', label: 'Left SoftKey (Soft1)', defaultTarget: 'F1', targetCode: 112, keys: ['F1', 'KeyQ'] },
    { id: 'RightSoft', label: 'Right SoftKey (Soft2)', defaultTarget: 'F2', targetCode: 113, keys: ['F2', 'KeyW'] },
    { id: 'Up', label: 'D-Pad Up', defaultTarget: 'ArrowUp', targetCode: 38, keys: ['ArrowUp', 'KeyI'] },
    { id: 'Down', label: 'D-Pad Down', defaultTarget: 'ArrowDown', targetCode: 40, keys: ['ArrowDown', 'KeyK'] },
    { id: 'Left', label: 'D-Pad Left', defaultTarget: 'ArrowLeft', targetCode: 37, keys: ['ArrowLeft', 'KeyJ'] },
    { id: 'Right', label: 'D-Pad Right', defaultTarget: 'ArrowRight', targetCode: 39, keys: ['ArrowRight', 'KeyL'] },
    { id: 'Select', label: 'Action / Select (OK)', defaultTarget: 'Enter', targetCode: 13, keys: ['Enter', 'Space'] },
    { id: 'Digit1', label: 'Key 1', defaultTarget: 'Digit1', targetCode: 49, keys: ['Digit1', 'Numpad1'] },
    { id: 'Digit2', label: 'Key 2 (ABC)', defaultTarget: 'Digit2', targetCode: 50, keys: ['Digit2', 'Numpad2'] },
    { id: 'Digit3', label: 'Key 3 (DEF)', defaultTarget: 'Digit3', targetCode: 51, keys: ['Digit3', 'Numpad3'] },
    { id: 'Digit4', label: 'Key 4 (GHI)', defaultTarget: 'Digit4', targetCode: 52, keys: ['Digit4', 'Numpad4'] },
    { id: 'Digit5', label: 'Key 5 (JKL)', defaultTarget: 'Digit5', targetCode: 53, keys: ['Digit5', 'Numpad5'] },
    { id: 'Digit6', label: 'Key 6 (MNO)', defaultTarget: 'Digit6', targetCode: 54, keys: ['Digit6', 'Numpad6'] },
    { id: 'Digit7', label: 'Key 7 (PQRS)', defaultTarget: 'Digit7', targetCode: 55, keys: ['Digit7', 'Numpad7'] },
    { id: 'Digit8', label: 'Key 8 (TUV)', defaultTarget: 'Digit8', targetCode: 56, keys: ['Digit8', 'Numpad8'] },
    { id: 'Digit9', label: 'Key 9 (WXYZ)', defaultTarget: 'Digit9', targetCode: 57, keys: ['Digit9', 'Numpad9'] },
    { id: 'Digit0', label: 'Key 0 (+)', defaultTarget: 'Digit0', targetCode: 48, keys: ['Digit0', 'Numpad0'] },
    { id: 'Star', label: 'Asterisk (*)', defaultTarget: 'NumpadAsterisk', targetCode: 106, keys: ['KeyE', 'NumpadMultiply'] },
    { id: 'Pound', label: 'Pound (#)', defaultTarget: 'NumpadDivide', targetCode: 111, keys: ['KeyR', 'NumpadDivide'] },
];

let activeBindings = null;
let currentlyRebindingId = null;
let keyListenerHandler = null;

export function getStoredKeyBindings() {
    if (activeBindings) return activeBindings;

    try {
        const raw = localStorage.getItem(STORAGE_KEY_DESKTOP_KEYS);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                // Merge with defaults to ensure all properties exist
                activeBindings = DEFAULT_KEY_BINDINGS.map(def => {
                    const match = parsed.find(p => p.id === def.id);
                    if (match) {
                        return {
                            ...def,
                            targetCode: typeof match.targetCode === 'number' ? match.targetCode : def.targetCode,
                            keys: Array.isArray(match.keys) ? match.keys : [...def.keys]
                        };
                    }
                    return { ...def, keys: [...def.keys] };
                });
                return activeBindings;
            }
        }
    } catch (e) {
        console.warn("Failed to parse desktop key bindings:", e);
    }

    activeBindings = DEFAULT_KEY_BINDINGS.map(def => ({ ...def, keys: [...def.keys] }));
    return activeBindings;
}

export function saveKeyBindings(bindings) {
    activeBindings = bindings;
    try {
        localStorage.setItem(STORAGE_KEY_DESKTOP_KEYS, JSON.stringify(bindings));
    } catch (e) {
        console.warn("Failed to save desktop key bindings:", e);
    }
}

export function resetKeyBindingsToDefault() {
    activeBindings = DEFAULT_KEY_BINDINGS.map(def => ({ ...def, keys: [...def.keys] }));
    try {
        localStorage.removeItem(STORAGE_KEY_DESKTOP_KEYS);
    } catch (e) {}
    return activeBindings;
}

export function getMappedTarget(eCode) {
    const bindings = getStoredKeyBindings();
    for (const binding of bindings) {
        if (binding.keys && binding.keys.includes(eCode)) {
            return {
                targetKey: binding.defaultTarget,
                targetCode: binding.targetCode
            };
        }
    }
    return null;
}

export function getCustomCodeForTarget(targetKey) {
    const bindings = getStoredKeyBindings();
    const match = bindings.find(b => b.defaultTarget === targetKey);
    return match ? match.targetCode : null;
}

export function formatKeyDisplay(codeStr) {
    if (!codeStr) return '';
    if (codeStr.startsWith('Key')) return codeStr.substring(3);
    if (codeStr.startsWith('Digit')) return codeStr.substring(5);
    if (codeStr.startsWith('Numpad')) return 'Num' + codeStr.substring(6);
    if (codeStr === 'ArrowUp') return '↑';
    if (codeStr === 'ArrowDown') return '↓';
    if (codeStr === 'ArrowLeft') return '←';
    if (codeStr === 'ArrowRight') return '→';
    if (codeStr === 'Escape') return 'Esc';
    if (codeStr === 'Space') return 'Space';
    if (codeStr === 'Enter') return 'Enter';
    return codeStr;
}

/*
 * Create and render the Desktop Control Customizer Modal (White & Cyan Theme)
 */
export function openDesktopControlsModal(onSavedCallback) {
    let modal = document.getElementById('desktop-controls-modal');
    if (!modal) {
        modal = createModalDOM();
    }

    renderModalContent(onSavedCallback);
    modal.classList.remove('hidden');
}

function createModalDOM() {
    const modal = document.createElement('div');
    modal.id = 'desktop-controls-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm hidden select-none transition-all duration-200';
    modal.innerHTML = `
        <div class="bg-white text-slate-800 border border-cyan-300 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <!-- Modal Header -->
            <div class="p-5 sm:p-6 border-b border-cyan-100 flex items-center justify-between bg-cyan-50/50">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-2xl bg-cyan-100 border border-cyan-300 flex items-center justify-center text-cyan-600">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 0121 9z"/></svg>
                    </div>
                    <div>
                        <h2 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Desktop Keyboard Mapping</h2>
                        <p class="text-xs text-slate-500">Customize keys and change key codes for desktop play.</p>
                    </div>
                </div>
                <button id="modal-close-icon-btn" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-cyan-100 text-slate-500 hover:text-cyan-700 flex items-center justify-center transition-colors cursor-pointer">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>

            <!-- Listening Status Banner -->
            <div id="rebinding-status-banner" class="hidden px-6 py-2.5 bg-cyan-500 text-slate-950 text-xs font-bold flex items-center justify-between animate-pulse">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
                    <span id="rebinding-status-text">Listening for keypress... Press any key on your keyboard.</span>
                </div>
                <button id="cancel-rebind-btn" class="px-2 py-0.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded text-[11px] font-semibold border border-cyan-600 cursor-pointer">Cancel</button>
            </div>

            <!-- Modal Body (Keys List) -->
            <div class="p-4 sm:p-6 overflow-y-auto space-y-3 custom-scrollbar flex-1 max-h-[60vh]" id="modal-keys-list">
                <!-- Dynamically populated -->
            </div>

            <!-- Modal Footer -->
            <div class="p-4 sm:p-5 border-t border-cyan-100 bg-cyan-50/50 flex flex-wrap items-center justify-between gap-3 text-xs">
                <button id="modal-reset-all-btn" class="px-4 py-2.5 bg-white hover:bg-cyan-50 text-slate-700 font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs">
                    <svg class="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    Reset All Defaults
                </button>

                <div class="flex items-center gap-2">
                    <button id="modal-cancel-btn" class="px-4 py-2.5 bg-white hover:bg-cyan-50 text-slate-700 font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer shadow-2xs">
                        Close
                    </button>
                    <button id="modal-save-btn" class="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold rounded-xl shadow-lg shadow-cyan-500/20 transition-colors flex items-center gap-1.5 cursor-pointer">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                        Save Controls
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('modal-close-icon-btn').onclick = closeModal;
    document.getElementById('modal-cancel-btn').onclick = closeModal;

    return modal;
}

function closeModal() {
    stopRebindingListener();
    const modal = document.getElementById('desktop-controls-modal');
    if (modal) modal.classList.add('hidden');
}

function renderModalContent(onSavedCallback) {
    const listContainer = document.getElementById('modal-keys-list');
    if (!listContainer) return;

    const bindings = getStoredKeyBindings();

    listContainer.innerHTML = '';

    bindings.forEach(binding => {
        const item = document.createElement('div');
        item.className = 'p-3.5 bg-white hover:bg-cyan-50/40 border border-slate-200 hover:border-cyan-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 transition-colors shadow-2xs';

        const keysHtml = binding.keys.length > 0
            ? binding.keys.map(k => `<kbd class="px-2 py-1 bg-cyan-50 border border-cyan-200 rounded-lg text-cyan-700 font-mono text-xs font-bold shadow-2xs">${formatKeyDisplay(k)}</kbd>`).join(' ')
            : `<span class="text-slate-400 text-xs italic">Unassigned</span>`;

        item.innerHTML = `
            <div class="flex flex-col min-w-[140px] flex-1">
                <span class="text-xs font-bold text-slate-800">${binding.label}</span>
                <span class="text-[11px] text-slate-500">Default Target: <code class="text-cyan-600 font-semibold">${binding.defaultTarget}</code></span>
            </div>

            <!-- Key Code Input -->
            <div class="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Code:</span>
                <input type="number" data-id="${binding.id}" class="key-code-input w-14 text-center bg-white border border-slate-300 rounded-lg text-cyan-700 font-mono text-xs font-bold py-0.5 focus:outline-none focus:border-cyan-500" value="${binding.targetCode}" title="Numeric J2ME keycode" />
            </div>

            <!-- Assigned Keys Badges -->
            <div class="flex items-center gap-1.5 flex-wrap min-w-[120px]">
                ${keysHtml}
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-1.5 ml-auto">
                <button data-id="${binding.id}" class="rebind-key-btn px-2.5 py-1.5 bg-cyan-100 hover:bg-cyan-200 text-cyan-800 border border-cyan-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    Rebind
                </button>

                <button data-id="${binding.id}" class="reset-single-key-btn p-1.5 bg-slate-100 hover:bg-cyan-100 text-slate-500 hover:text-cyan-700 rounded-xl transition-colors cursor-pointer" title="Reset this key to default">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                </button>
            </div>
        `;

        listContainer.appendChild(item);
    });

    // Attach Event Handlers
    // 1. Numeric Key Code Inputs
    document.querySelectorAll('.key-code-input').forEach(input => {
        input.onchange = (e) => {
            const id = e.target.dataset.id;
            const newCode = parseInt(e.target.value, 10);
            if (!isNaN(newCode)) {
                const bindings = getStoredKeyBindings();
                const target = bindings.find(b => b.id === id);
                if (target) {
                    target.targetCode = newCode;
                }
            }
        };
    });

    // 2. Rebind Buttons
    document.querySelectorAll('.rebind-key-btn').forEach(btn => {
        btn.onclick = (e) => {
            const id = e.currentTarget.dataset.id;
            startRebindingKey(id, onSavedCallback);
        };
    });

    // 3. Reset Single Key Buttons
    document.querySelectorAll('.reset-single-key-btn').forEach(btn => {
        btn.onclick = (e) => {
            const id = e.currentTarget.dataset.id;
            const def = DEFAULT_KEY_BINDINGS.find(d => d.id === id);
            if (def) {
                const bindings = getStoredKeyBindings();
                const target = bindings.find(b => b.id === id);
                if (target) {
                    target.targetCode = def.targetCode;
                    target.keys = [...def.keys];
                    saveKeyBindings(bindings);
                    renderModalContent(onSavedCallback);
                }
            }
        };
    });

    // 4. Reset All Button
    document.getElementById('modal-reset-all-btn').onclick = () => {
        resetKeyBindingsToDefault();
        renderModalContent(onSavedCallback);
        if (typeof onSavedCallback === 'function') onSavedCallback();
    };

    // 5. Save Button
    document.getElementById('modal-save-btn').onclick = () => {
        // Read code inputs
        document.querySelectorAll('.key-code-input').forEach(input => {
            const id = input.dataset.id;
            const val = parseInt(input.value, 10);
            if (!isNaN(val)) {
                const bindings = getStoredKeyBindings();
                const match = bindings.find(b => b.id === id);
                if (match) match.targetCode = val;
            }
        });

        saveKeyBindings(getStoredKeyBindings());
        closeModal();
        if (typeof onSavedCallback === 'function') onSavedCallback();
    };

    document.getElementById('cancel-rebind-btn').onclick = stopRebindingListener;
}

function startRebindingKey(id, onSavedCallback) {
    stopRebindingListener();

    currentlyRebindingId = id;
    const banner = document.getElementById('rebinding-status-banner');
    const textEl = document.getElementById('rebinding-status-text');

    const bindings = getStoredKeyBindings();
    const target = bindings.find(b => b.id === id);

    if (banner && textEl && target) {
        textEl.textContent = `Press any keyboard key to rebind [${target.label}]...`;
        banner.classList.remove('hidden');
    }

    keyListenerHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.code === 'Escape') {
            stopRebindingListener();
            return;
        }

        const newCode = e.code;
        if (target) {
            // Remove this key from any other binding to prevent conflict
            bindings.forEach(b => {
                b.keys = b.keys.filter(k => k !== newCode);
            });

            // Add to this target
            if (!target.keys.includes(newCode)) {
                target.keys.push(newCode);
            }

            saveKeyBindings(bindings);
        }

        stopRebindingListener();
        renderModalContent(onSavedCallback);
    };

    window.addEventListener('keydown', keyListenerHandler, { capture: true, once: true });
}

function stopRebindingListener() {
    if (keyListenerHandler) {
        window.removeEventListener('keydown', keyListenerHandler, { capture: true });
        keyListenerHandler = null;
    }

    currentlyRebindingId = null;
    const banner = document.getElementById('rebinding-status-banner');
    if (banner) banner.classList.add('hidden');
}

/*
 * Update key badges in the index.html reference card
 */
export function updateIndexPageKeyBadges() {
    const bindings = getStoredKeyBindings();

    bindings.forEach(binding => {
        const badgeContainer = document.querySelector(`[data-key-display="${binding.id}"]`);
        if (badgeContainer) {
            if (binding.keys && binding.keys.length > 0) {
                badgeContainer.innerHTML = binding.keys.map(k =>
                    `<kbd class="px-2 py-1 bg-cyan-50 border border-cyan-200 rounded-md font-mono text-cyan-700 font-bold shadow-2xs">${formatKeyDisplay(k)}</kbd>`
                ).join(' ');
            } else {
                badgeContainer.innerHTML = `<span class="text-slate-400 font-mono text-[11px]">None</span>`;
            }
        }
    });
}