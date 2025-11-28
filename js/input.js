// central input module (exports key state)
const keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

export function setupInput() { /* left placeholder in case we want init logic */ }
export function isKey(k) { return !!keys[k.toLowerCase()]; }
export function getKeys() { return keys; }
