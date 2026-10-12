/*
 * Screen Keypad Handler
 * Handles touch & mouse pointer events for individual on-screen keys,
 * forwarding key down/up events to FreeJ2ME.
 */

import { isKeypadInEditMode } from "./layoutManager.js";

export const kbdWidth = 220, kbdHeight = 220;

const touchKeyMap = new Map(); // Map<touch.identifier, Element>
let handleKey = null;

function getKeyAtPoint(x, y) {
    return document.elementFromPoint(x, y)?.closest('.key');
}

function activateKey(key) {
    if (key && !key.classList.contains('active')) {
        key.classList.add('active');

        if (key.dataset.key === 'Maximize') {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            } else {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        }

        if (handleKey && key.dataset.key) {
            handleKey(true, key.dataset.key);
        }
    }
}

function deactivateKey(key) {
    if (key && key.classList.contains('active')) {
        key.classList.remove('active');
        if (handleKey && key.dataset.key) {
            handleKey(false, key.dataset.key);
        }
    }
}

// Handle Touch Events
function handleTouchStart(e) {
    if (isKeypadInEditMode()) return;

    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const key = getKeyAtPoint(touch.clientX, touch.clientY);
        if (key) {
            e.preventDefault();
            touchKeyMap.set(touch.identifier, key);
            activateKey(key);
        }
    }
}

function handleTouchMove(e) {
    if (isKeypadInEditMode()) return;

    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const currentKey = getKeyAtPoint(touch.clientX, touch.clientY);
        const previousKey = touchKeyMap.get(touch.identifier);

        if (currentKey !== previousKey) {
            if (previousKey) deactivateKey(previousKey);
            if (currentKey) {
                e.preventDefault();
                activateKey(currentKey);
                touchKeyMap.set(touch.identifier, currentKey);
            } else {
                touchKeyMap.delete(touch.identifier);
            }
        }
    }
}

function handleTouchEnd(e) {
    if (isKeypadInEditMode()) return;

    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const key = touchKeyMap.get(touch.identifier);
        if (key) {
            e.preventDefault();
            deactivateKey(key);
            touchKeyMap.delete(touch.identifier);
        }
    }
}

export function initKbdListeners() {
    // Touch event listeners globally / document wide for flexible key locations
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    // Pointer / Mouse events on desktop & trackpads
    document.addEventListener('pointerdown', (e) => {
        if (isKeypadInEditMode()) return;
        if (e.pointerType === 'touch') return; // Handled by touch events
        const key = e.target?.closest('.key');
        if (key) {
            activateKey(key);
        }
    });

    document.addEventListener('pointerup', (e) => {
        if (isKeypadInEditMode()) return;
        if (e.pointerType === 'touch') return;
        const key = e.target?.closest('.key');
        if (key) {
            deactivateKey(key);
        } else {
            document.querySelectorAll('.key.active').forEach(deactivateKey);
        }
    });

    document.addEventListener('pointercancel', () => {
        document.querySelectorAll('.key.active').forEach(deactivateKey);
    });
}

export function setKbdHandler(handler) {
    handleKey = handler;
}
