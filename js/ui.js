// Creates all DOM overlays (splash + menu) dynamically and returns callbacks
import { getAvailableCharacters, getAvailableStages } from './characters.js';
import { setAIFlag } from './game.js';

let menuOverlay, splashOverlay;

export function createSplash(onContinue) {
    splashOverlay = document.createElement('div');
    Object.assign(splashOverlay.style, {
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    });
    const panel = document.createElement('div');
    Object.assign(panel.style, { background: 'rgba(0,0,0,0.7)', padding: '28px', borderRadius: '8px', color: '#fff', textAlign: 'center' });
    panel.innerHTML = `<h1 style="margin:0 0 8px 0">RETRO PUNCH</h1>
    <div style="font-size:14px;color:#ffd26a;margin-bottom:10px">INSERT COIN</div>
    <div style="font-size:12px;color:#ddd">Press Enter to continue</div>`;
    splashOverlay.appendChild(panel);
    document.body.appendChild(splashOverlay);

    function key(ev) {
        if (ev.key.toLowerCase() === 'enter') {
            window.removeEventListener('keydown', key);
            document.body.removeChild(splashOverlay);
            onContinue();
        }
    }
    window.addEventListener('keydown', key);
}

export function createMenu({ onStartMatch }) {
    menuOverlay = document.createElement('div');
    Object.assign(menuOverlay.style, { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 });
    const panel = document.createElement('div');
    Object.assign(panel.style, { background: 'rgba(0,0,0,0.8)', padding: '18px', borderRadius: '8px', color: '#fff', width: '760px', maxWidth: '94%' });

    // Character lists
    const chars = getAvailableCharacters();
    const stages = getAvailableStages();

    let selection = { p1: chars[0].id, p2: chars.length > 1 ? chars[1].id : chars[0].id, stage: stages[0].id, p2IsAI: false };

    function makeOptions(title, items, onPick, selectedId) {
        const wrapper = document.createElement('div');
        const h = document.createElement('h3'); h.textContent = title; wrapper.appendChild(h);
        const grid = document.createElement('div'); Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' });
        items.forEach(it => {
            const opt = document.createElement('div');
            opt.textContent = it.name;
            Object.assign(opt.style, { padding: '8px', background: '#122', cursor: 'pointer', borderRadius: '6px' });
            if (it.id === selectedId) opt.style.outline = '2px solid #f25';
            opt.addEventListener('click', () => {
                onPick(it.id);
                // refresh visuals
                grid.querySelectorAll('div').forEach(d => d.style.outline = '');
                opt.style.outline = '2px solid #f25';
            });
            grid.appendChild(opt);
        });
        wrapper.appendChild(grid);
        return wrapper;
    }

    const p1Block = makeOptions('Player 1', chars, id => selection.p1 = id, selection.p1);
    const p2Block = makeOptions('Player 2', chars, id => selection.p2 = id, selection.p2);
    const stageBlock = makeOptions('Stage', stages, id => selection.stage = id, selection.stage);

    // AI toggle
    const row = document.createElement('div'); Object.assign(row.style, { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px' });
    const label = document.createElement('div'); label.textContent = 'P2 Control:';
    const toggle = document.createElement('button'); toggle.textContent = 'Human';
    Object.assign(toggle.style, { padding: '6px 10px', cursor: 'pointer' });
    toggle.addEventListener('click', () => {
        selection.p2IsAI = !selection.p2IsAI;
        toggle.textContent = selection.p2IsAI ? 'AI' : 'Human';
        setAIFlag(selection.p2IsAI);
    });
    row.appendChild(label); row.appendChild(toggle);

    const startBtn = document.createElement('button');
    startBtn.textContent = 'Start Match (Enter)';
    Object.assign(startBtn.style, { marginTop: '12px', padding: '8px 12px', cursor: 'pointer' });
    startBtn.addEventListener('click', () => { document.body.removeChild(menuOverlay); onStartMatch(selection); });

    panel.appendChild(p1Block); panel.appendChild(p2Block); panel.appendChild(row); panel.appendChild(stageBlock); panel.appendChild(startBtn);
    menuOverlay.appendChild(panel);
    document.body.appendChild(menuOverlay);

    // Enter key also starts match
    function onKey(e) {
        if (e.key.toLowerCase() === 'enter') {
            window.removeEventListener('keydown', onKey);
            document.body.removeChild(menuOverlay);
            onStartMatch(selection);
        }
    }
    window.addEventListener('keydown', onKey);
}
