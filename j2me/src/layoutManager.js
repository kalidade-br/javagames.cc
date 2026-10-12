/*
 * Individual Key Layout Manager for J2ME Web Loader
 * Allows dragging, resizing, deleting, saving, exporting, importing, and resetting
 * EVERY INDIVIDUAL KEY button on mobile or desktop view.
 */

function getStorageKey() {
    try {
        const params = new URLSearchParams(window.location.search);
        const appId = params.get('app');
        if (appId) {
            return `j2me_kbd_layout_${appId}`;
        }
    } catch (e) {}
    return 'j2me_individual_keys_layout_v4';
}

function getAppId() {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get('app') || '';
    } catch (e) {
        return '';
    }
}

let isEditMode = false;

export async function initLayoutManager(autoscaleCallback) {
    // 1. Decorate every key with resize handle and delete button
    setupIndividualKeyDecorations();

    // 2. Build Edit Mode toolbar
    setupEditToolbar(autoscaleCallback);

    // 3. Attach drag & resize event listeners to every key button
    attachKeyDragAndResize(autoscaleCallback);

    // 4. Load saved custom key layout if exists
    await loadAndApplySavedLayout();
}

export function isKeypadInEditMode() {
    return isEditMode;
}

function setupIndividualKeyDecorations() {
    const keys = document.querySelectorAll('.key');
    keys.forEach(key => {
        if (!key.querySelector('.key-resize-handle')) {
            const handle = document.createElement('div');
            handle.className = 'key-resize-handle hidden absolute bottom-0 right-0 w-4 h-4 bg-cyan-500 hover:bg-cyan-400 text-white flex items-center justify-center rounded-full border-t border-l border-cyan-200 cursor-se-resize z-30 shadow-xs select-none';
            handle.innerHTML = `<svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M19 0h-5c-.55 0-1 .45-1 1s.45 1 1 1h2.59L11.3 7.29c-.19.18-.3.43-.3.71a1.003 1.003 0 0 0 1.71.71L18 3.41V6c0 .55.45 1 1 1s1-.45 1-1V1c0-.55-.45-1-1-1M8 11c-.28 0-.53.11-.71.29L2 16.59V14c0-.55-.45-1-1-1s-1 .45-1 1v5c0 .55.45 1 1 1h5c.55 0 1-.45 1-1s-.45-1-1-1H3.41l5.29-5.29c.19-.18.3-.43.3-.71 0-.55-.45-1-1-1"/></svg>`;

            key.appendChild(handle);
        }

        if (!key.querySelector('.key-delete-btn')) {
            const delBtn = document.createElement('div');
            delBtn.className = 'key-delete-btn hidden absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-red-600 hover:bg-red-500 text-white flex items-center justify-center rounded-full cursor-pointer z-50 shadow-md border border-white select-none';
            delBtn.title = 'Delete key';
            delBtn.innerHTML = `<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`;

            const handleDelete = (e) => {
                e.preventDefault();
                e.stopPropagation();
                key.style.display = 'none';
                key.dataset.deleted = 'true';
                saveCurrentLayout();
                showToast(`Key "${key.dataset.key || ''}" deleted. Click Reset to restore.`);
            };

            delBtn.addEventListener('click', handleDelete);
            delBtn.addEventListener('touchstart', handleDelete, { passive: false });

            key.appendChild(delBtn);
        }
    });
}

function freezeAllKeysToFixed() {
    const keys = document.querySelectorAll('.key');
    const coords = [];
    
    // Read all current screen positions
    keys.forEach(key => {
        if (key.dataset.deleted === 'true' || key.style.display === 'none') return;
        if (key.style.position !== 'fixed') {
            const rect = key.getBoundingClientRect();
            coords.push({ el: key, left: rect.left, top: rect.top, width: rect.width, height: rect.height });
        }
    });

    // Apply fixed coordinates to lock each key in place
    coords.forEach(({ el, left, top, width, height }) => {
        el.style.position = 'fixed';
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.width = `${width}px`;
        el.style.height = `${height}px`;
        el.style.zIndex = '40';
    });

    if (coords.length > 0) {
        document.body.classList.add('kbd-has-custom-layout');
    }
}

function setupEditToolbar(autoscaleCallback) {
    if (document.getElementById('keypad-edit-toolbar')) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'keypad-edit-toolbar';
    toolbar.className = 'fixed top-14 left-1/2 -translate-x-1/2 z-50 hidden bg-white-900/95 text-white border border-cyan-500/50 rounded-2xl shadow-2xl p-2.5 backdrop-blur-xl transition-all duration-300 max-w-full w-[94vw] sm:w-auto select-none';
    toolbar.innerHTML = `
<div class="flex flex-wrap items-center justify-center gap-2 text-xs">

    <div class="h-4 w-px bg-slate-200 mx-0.5 hidden sm:block"></div>

    <button id="layout-save-btn" class="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        Save
    </button>

    <button id="layout-reset-btn" class="px-3 py-1.5 bg-white hover:bg-cyan-50 text-slate-700 font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs">
        <svg class="w-3.5 h-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        Reset
    </button>

    <button id="layout-export-btn" class="px-3 py-1.5 bg-white hover:bg-cyan-50 text-slate-700 font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs">
        <svg class="w-3.5 h-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
        Export
    </button>

    <label id="layout-import-label" class="px-3 py-1.5 bg-white hover:bg-cyan-50 text-slate-700 font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs">
        <svg class="w-3.5 h-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
        Import
        <input type="file" id="layout-import-file" accept=".json" class="hidden" />
    </label>

    <button id="layout-close-btn" class="px-3 py-1.5 bg-cyan-100 hover:bg-cyan-200 text-cyan-800 border border-cyan-300 font-extrabold rounded-xl transition-colors flex items-center gap-1 cursor-pointer ml-1">
        Done
    </button>
</div>
    `;

    document.body.appendChild(toolbar);

    // Toast element for feedback messages
    const toast = document.createElement('div');
    toast.id = 'keypad-toast';
    toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 hidden bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xl border border-cyan-500/50 flex items-center gap-2 transition-all duration-300 pointer-events-none';
    document.body.appendChild(toast);

    // Toolbar Buttons Action Listeners
    document.getElementById('layout-save-btn').onclick = () => {
        saveCurrentLayout();
        showToast('Individual key layout saved successfully!');
    };

    document.getElementById('layout-reset-btn').onclick = () => {
        resetLayoutToDefault(autoscaleCallback);
        showToast('Keypad layout reset to default.');
    };

    document.getElementById('layout-export-btn').onclick = () => {
        exportLayoutToFile();
    };

    document.getElementById('layout-import-file').onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
            importLayoutFromFile(file, autoscaleCallback);
            e.target.value = '';
        }
    };

    document.getElementById('layout-close-btn').onclick = () => {
        toggleLayoutEditMode(false, autoscaleCallback);
    };
}

export function toggleLayoutEditMode(enable, autoscaleCallback) {
    isEditMode = (enable !== undefined) ? enable : !isEditMode;

    setupIndividualKeyDecorations();

    const toolbar = document.getElementById('keypad-edit-toolbar');
    const handles = document.querySelectorAll('.key-resize-handle');
    const deleteBtns = document.querySelectorAll('.key-delete-btn');
    const keys = document.querySelectorAll('.key');

    // Ensure keypads are visible
    const leftKeys = document.getElementById('left-keys');
    const rightKeys = document.getElementById('right-keys');
    if (leftKeys) leftKeys.style.display = 'flex';
    if (rightKeys) rightKeys.style.display = 'flex';

    if (isEditMode) {
        document.body.classList.add('kbd-edit-mode');
        // Convert all keys to fixed coordinates so sibling keys don't shift or reflow
        freezeAllKeysToFixed();

        if (toolbar) toolbar.classList.remove('hidden');

        handles.forEach(h => h.classList.remove('hidden'));
        deleteBtns.forEach(d => d.classList.remove('hidden'));
        keys.forEach(k => {
            if (k.dataset.deleted !== 'true') {
                k.classList.add('ring-2', 'ring-cyan-400', 'ring-offset-1', 'shadow-lg');
            }
        });

        showToast('Drag key to move; drag corner handle to resize; click red X to delete.');
    } else {
        document.body.classList.remove('kbd-edit-mode');
        if (toolbar) toolbar.classList.add('hidden');

        handles.forEach(h => h.classList.add('hidden'));
        deleteBtns.forEach(d => d.classList.add('hidden'));
        keys.forEach(k => {
            k.classList.remove('ring-2', 'ring-cyan-400', 'ring-offset-1', 'shadow-lg');
        });
    }

    if (typeof autoscaleCallback === 'function') {
        autoscaleCallback();
    }
}

function attachKeyDragAndResize(autoscaleCallback) {
    const keys = document.querySelectorAll('.key');

    keys.forEach(key => {
        let isDragging = false;
        let isResizing = false;
        let startX = 0, startY = 0;
        let startLeft = 0, startTop = 0;
        let startWidth = 0, startHeight = 0;

        function getPointerPos(e) {
            if (e.touches && e.touches.length > 0) {
                return { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
            return { x: e.clientX, y: e.clientY };
        }

        const handlePointerDown = (e) => {
            if (!isEditMode) return;
            if (e.target.closest('.key-delete-btn')) return;

            // Ensure every key is anchored in fixed coordinates before dragging starts
            freezeAllKeysToFixed();

            const resizeHandle = e.target.closest('.key-resize-handle');
            const pos = getPointerPos(e);
            startX = pos.x;
            startY = pos.y;

            const rect = key.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            startWidth = rect.width;
            startHeight = rect.height;

            if (resizeHandle) {
                isResizing = true;
                e.preventDefault();
                e.stopPropagation();

                window.addEventListener('mousemove', onResizeMove, { passive: false });
                window.addEventListener('mouseup', onResizeEnd);
                window.addEventListener('touchmove', onResizeMove, { passive: false });
                window.addEventListener('touchend', onResizeEnd);
            } else {
                isDragging = true;
                e.preventDefault();
                e.stopPropagation();

                key.style.position = 'fixed';
                key.style.left = `${startLeft}px`;
                key.style.top = `${startTop}px`;
                key.style.width = `${startWidth}px`;
                key.style.height = `${startHeight}px`;
                key.style.zIndex = '100';

                window.addEventListener('mousemove', onDragMove, { passive: false });
                window.addEventListener('mouseup', onDragEnd);
                window.addEventListener('touchmove', onDragMove, { passive: false });
                window.addEventListener('touchend', onDragEnd);
            }
        };

        function onDragMove(e) {
            if (!isDragging) return;
            e.preventDefault();

            const pos = getPointerPos(e);
            const dx = pos.x - startX;
            const dy = pos.y - startY;

            let newLeft = startLeft + dx;
            let newTop = startTop + dy;

            const maxLeft = window.innerWidth - key.offsetWidth;
            const maxTop = window.innerHeight - key.offsetHeight;

            newLeft = Math.max(0, Math.min(maxLeft, newLeft));
            newTop = Math.max(0, Math.min(maxTop, newTop));

            key.style.left = `${newLeft}px`;
            key.style.top = `${newTop}px`;
        }

        function onDragEnd() {
            if (!isDragging) return;
            isDragging = false;
            key.style.zIndex = '40';

            window.removeEventListener('mousemove', onDragMove);
            window.removeEventListener('mouseup', onDragEnd);
            window.removeEventListener('touchmove', onDragMove);
            window.removeEventListener('touchend', onDragEnd);

            document.body.classList.add('kbd-has-custom-layout');

            if (typeof autoscaleCallback === 'function') {
                autoscaleCallback();
            }
        }

        function onResizeMove(e) {
            if (!isResizing) return;
            e.preventDefault();

            const pos = getPointerPos(e);
            const dx = pos.x - startX;
            const dy = pos.y - startY;

            const newWidth = Math.max(30, Math.min(window.innerWidth, startWidth + dx));
            const newHeight = Math.max(30, Math.min(window.innerHeight, startHeight + dy));

            key.style.width = `${newWidth}px`;
            key.style.height = `${newHeight}px`;
        }

        function onResizeEnd() {
            if (!isResizing) return;
            isResizing = false;

            window.removeEventListener('mousemove', onResizeMove);
            window.removeEventListener('mouseup', onResizeEnd);
            window.removeEventListener('touchmove', onResizeMove);
            window.removeEventListener('touchend', onResizeEnd);

            document.body.classList.add('kbd-has-custom-layout');

            if (typeof autoscaleCallback === 'function') {
                autoscaleCallback();
            }
        }

        key.addEventListener('mousedown', handlePointerDown);
        key.addEventListener('touchstart', handlePointerDown, { passive: false });
    });
}

function saveCurrentLayout() {
    freezeAllKeysToFixed();

    const keys = document.querySelectorAll('.key');
    const layoutData = {
        version: 5,
        timestamp: Date.now(),
        keys: {}
    };

    let hasCustomKey = false;
    keys.forEach(key => {
        const keyId = key.dataset.key;
        if (!keyId) return;

        const isDeleted = key.dataset.deleted === 'true' || key.style.display === 'none';
        const isFixed = key.style.position === 'fixed';

        if (isFixed || isDeleted) {
            hasCustomKey = true;
            layoutData.keys[keyId] = {
                position: isFixed ? 'fixed' : '',
                left: key.style.left,
                top: key.style.top,
                width: key.style.width,
                height: key.style.height,
                deleted: isDeleted
            };
        }
    });

    const storageKey = getStorageKey();
    const appId = getAppId();
    if (hasCustomKey) {
        const jsonStr = JSON.stringify(layoutData);
        localStorage.setItem(storageKey, jsonStr);
        document.body.classList.add('kbd-has-custom-layout');

        if (appId && window.cheerpjAddStringFile) {
            try {
                window.cheerpjAddStringFile(`/files/${appId}/config/keypad_layout.json`, jsonStr);
            } catch (e) {}
        }
    } else {
        localStorage.removeItem(storageKey);
        document.body.classList.remove('kbd-has-custom-layout');

        if (appId && window.cheerpjAddStringFile) {
            try {
                window.cheerpjAddStringFile(`/files/${appId}/config/keypad_layout.json`, "");
            } catch (e) {}
        }
    }
}

async function loadAndApplySavedLayout() {
    try {
        const storageKey = getStorageKey();
        let raw = localStorage.getItem(storageKey);

        if (!raw) {
            const appId = getAppId();
            const getBlob = window.cjFileBlob || (typeof cjFileBlob !== 'undefined' ? cjFileBlob : null);
            if (getBlob && appId) {
                try {
                    const blob = await getBlob(`/files/${appId}/config/keypad_layout.json`);
                    if (blob) {
                        const txt = await blob.text();
                        if (txt && txt.trim()) {
                            raw = txt.trim();
                            localStorage.setItem(storageKey, raw);
                        }
                    }
                } catch (e) {}
            }
        }

        if (!raw) return false;

        const data = JSON.parse(raw);
        if (!data || !data.keys) return false;

        applyLayoutObject(data);
        return true;
    } catch (e) {
        console.warn("Failed to load custom key layout:", e);
        return false;
    }
}

function applyLayoutObject(data) {
    if (!data || !data.keys) return;

    let count = 0;
    Object.keys(data.keys).forEach(keyId => {
        const key = document.querySelector(`.key[data-key="${keyId}"]`);
        if (!key) return;

        const spec = data.keys[keyId];
        if (spec) {
            if (spec.deleted) {
                key.style.display = 'none';
                key.dataset.deleted = 'true';
            } else {
                key.style.display = '';
                key.dataset.deleted = 'false';
            }

            if (spec.position) key.style.position = spec.position;
            if (spec.left) key.style.left = spec.left;
            if (spec.top) key.style.top = spec.top;
            if (spec.width) key.style.width = spec.width;
            if (spec.height) key.style.height = spec.height;
            if (spec.position === 'fixed') key.style.zIndex = '40';
            count++;
        }
    });

    if (count > 0) {
        document.body.classList.add('kbd-has-custom-layout');
    }
}

function resetLayoutToDefault(autoscaleCallback) {
    const storageKey = getStorageKey();
    localStorage.removeItem(storageKey);
    document.body.classList.remove('kbd-has-custom-layout');

    const appId = getAppId();
    if (appId && window.cheerpjAddStringFile) {
        try {
            window.cheerpjAddStringFile(`/files/${appId}/config/keypad_layout.json`, "");
        } catch (e) {}
    }

    const keys = document.querySelectorAll('.key');
    keys.forEach(key => {
        key.removeAttribute('style');
        key.style.display = '';
        key.dataset.deleted = 'false';
    });

    if (typeof autoscaleCallback === 'function') {
        autoscaleCallback();
    }
}

function exportLayoutToFile() {
    saveCurrentLayout();
    const storageKey = getStorageKey();
    const raw = localStorage.getItem(storageKey) || '{}';

    const appId = getAppId();
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `j2me-keypad-layout-${appId || 'default'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Layout exported successfully!');
}

function importLayoutFromFile(file, autoscaleCallback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data && data.keys) {
                resetLayoutToDefault(autoscaleCallback);
                applyLayoutObject(data);
                localStorage.setItem(getStorageKey(), JSON.stringify(data));
                showToast('Key layout imported successfully!');
                if (typeof autoscaleCallback === 'function') {
                    autoscaleCallback();
                }
            } else {
                showToast('Invalid layout file format!', true);
            }
        } catch (err) {
            showToast('Failed to parse layout JSON file!', true);
        }
    };
    reader.readAsText(file);
}

function showToast(message, isError = false) {
    const toast = document.getElementById('keypad-toast');
    if (!toast) return;

    toast.textContent = message;
    if (isError) {
        toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-900 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xl border border-red-500/50 flex items-center gap-2 transition-all duration-300 pointer-events-none';
    } else {
        toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xl border border-cyan-500/50 flex items-center gap-2 transition-all duration-300 pointer-events-none';
    }

    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

