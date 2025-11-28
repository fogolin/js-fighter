// Dynamic HUD created and managed from JS
let hud = null;
export function createHUD() {
    if (hud) return hud;
    hud = document.createElement('div'); Object.assign(hud.style, { position: 'fixed', left: '50%', transform: 'translateX(-50%)', top: '8px', zIndex: 500 });
    hud.innerHTML = `<div id="hud-inner" style="font-family:monospace;color:#fff"></div>`;
    document.body.appendChild(hud);
    return hud;
}
export function destroyHUD() { if (!hud) return; document.body.removeChild(hud); hud = null; }
export function renderHUDUpdate(state) {
    if (!hud) return;
    // state: { p1Name,p2Name, p1HP,p2HP, round, timer, p2IsAI }
    const inner = hud.querySelector('#hud-inner');
    inner.innerHTML = `<div style="display:flex;gap:12px;align-items:center">
    <div>${state.p1Name} <b style="color:#4ad04a">[${Math.round(state.p1HP)}]</b></div>
    <div style="color:#ffd26a">Round ${state.round}</div>
    <div>${state.p2Name} <b style="color:#f46">[${Math.round(state.p2HP)}]</b> ${state.p2IsAI ? '<span style="color:#8af;margin-left:8px">P2: AI</span>' : ''}</div>
    <div style="margin-left:12px;color:#ddd">${Math.max(0, Math.floor(state.timer))}s</div>
  </div>`;
}
