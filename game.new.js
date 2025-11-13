// Retro Punch - full single-file game logic
// Features included:
// - Responsive, full-browser canvas
// - Title splash (INSERT COIN) -> menu -> match
// - Dynamic HUD created at match start, removed after match
// - 90s round timer updated with wall-clock
// - Best-of-3 match (first to 3 wins)
// - Single guarded round-end path; prevents double-ending
// - KO slow-motion + KO splash before awarding round
// - Placeholder drawn characters and parallax layers (editable)

(() => {
    // CONFIG
    let WIDTH = window.innerWidth;
    let HEIGHT = window.innerHeight;
    const FLOOR_RATIO = 0.78;
    let FLOOR = Math.floor(HEIGHT * FLOOR_RATIO);
    const MAX_HEALTH = 100;
    const ROUNDS_TO_WIN = 3;
    const ROUND_DURATION = 90; // seconds

    // Canvas
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    function resizeCanvas() {
        WIDTH = window.innerWidth; HEIGHT = window.innerHeight;
        FLOOR = Math.floor(HEIGHT * FLOOR_RATIO);
        canvas.width = WIDTH; canvas.height = HEIGHT;
        // keep CSS sized to full viewport
        canvas.style.width = WIDTH + 'px';
        canvas.style.height = HEIGHT + 'px';
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Overlays / UI nodes
    const splashOverlay = document.getElementById('splashOverlay');
    const insertCoinEl = document.getElementById('insertCoin');
    const menuOverlay = document.getElementById('menuOverlay');
    const p1Opts = document.getElementById('p1-opts');
    const p2Opts = document.getElementById('p2-opts');
    const stageOpts = document.getElementById('stage-opts');
    const koTextEl = document.getElementById('koText');

    // Input
    const keys = {};
    window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

    // Timer helpers
    let last = performance.now();

    // Time scaling / slow motion
    let timeScale = 1;
    let timeScaleTarget = 1;
    let slowMoWallTimer = 0; // ms real time remaining for slowmo

    // Round / match state flags
    let gameState = 'splash'; // splash -> select -> fight -> matchWin
    let round = 1;
    let roundOver = false;
    let matchActive = false;
    let roundTimer = ROUND_DURATION; // seconds

    // HUD (created dynamically)
    let hud = null;
    function createHUD() {
        if (hud) return;
        hud = document.createElement('div');
        hud.id = 'dynamic-hud';
        hud.style.position = 'fixed';
        hud.style.left = '50%';
        hud.style.transform = 'translateX(-50%)';
        hud.style.top = '8px';
        hud.style.width = 'min(1200px,94%)';
        hud.style.pointerEvents = 'none';
        hud.style.zIndex = 999;
        hud.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.28);padding:8px 12px;border-radius:6px;color:#fff;font-family:monospace">
        <div style="width:36%;display:flex;flex-direction:column">
          <div id="hud-p1-name" style="font-size:14px"></div>
          <div style="height:16px;background:rgba(0,0,0,0.3);border-radius:4px;overflow:hidden;margin-top:6px">
            <div id="hud-p1-bar" style="height:100%;width:100%;background:#4ad04a"></div>
          </div>
        </div>
        <div style="text-align:center">
          <div id="hud-round" style="font-size:18px;color:#ffd26a">Round 1</div>
          <div id="hud-timer" style="font-size:16px;color:#fff">90</div>
        </div>
        <div style="width:36%;display:flex;flex-direction:column;align-items:flex-end">
          <div id="hud-p2-name" style="font-size:14px;text-align:right"></div>
          <div style="height:16px;background:rgba(0,0,0,0.3);border-radius:4px;overflow:hidden;margin-top:6px">
            <div id="hud-p2-bar" style="height:100%;width:100%;background:#f46"></div>
          </div>
        </div>
      </div>
    `;
        document.body.appendChild(hud);
        hud.p1Bar = document.getElementById('hud-p1-bar');
        hud.p2Bar = document.getElementById('hud-p2-bar');
        hud.p1Name = document.getElementById('hud-p1-name');
        hud.p2Name = document.getElementById('hud-p2-name');
        hud.round = document.getElementById('hud-round');
        hud.timer = document.getElementById('hud-timer');
    }
    function destroyHUD() {
        if (!hud) return;
        document.body.removeChild(hud);
        hud = null;
    }

    // Parallax stages
    const stages = {
        cafe: {
            name: "Local Café",
            layers: [
                { color: "#07111b", y: 0, scroll: 0.06 },
                { color: "#0f2a33", y: 110, scroll: 0.18 },
                { color: "#1f3a4a", y: 200, scroll: 0.36 },
                { color: "#2b4a5a", y: 300, scroll: 0.7 }
            ],
            floorColor: "#2a2318"
        },
        park: {
            name: "City Park",
            layers: [
                { color: "#04121a", y: 0, scroll: 0.06 },
                { color: "#0b2b22", y: 130, scroll: 0.2 },
                { color: "#186b3a", y: 230, scroll: 0.45 },
                { color: "#2b8a45", y: 320, scroll: 0.8 }
            ],
            floorColor: "#31402a"
        }
    };

    // Characters (placeholders). You can add more.
    const characters = {
        alex: {
            name: "Alex", w: 48, h: 64, scale: 1.6, speed: 4, jump: -14,
            moves: {
                punch: { startup: 3, active: 4, recovery: 8, dmg: 8, hitbox: { x: 28, y: 14, w: 26, h: 16 } },
                kick: { startup: 4, active: 4, recovery: 10, dmg: 12, hitbox: { x: 24, y: 36, w: 36, h: 14 } },
                special: { startup: 6, active: 6, recovery: 18, dmg: 20, hitbox: { x: 10, y: -30, w: 50, h: 60 }, effect: 'rise' }
            }
        },
        beth: {
            name: "Beth", w: 46, h: 62, scale: 1.8, speed: 3.6, jump: -13,
            moves: {
                punch: { startup: 2, active: 3, recovery: 10, dmg: 6, hitbox: { x: 26, y: 12, w: 24, h: 14 } },
                kick: { startup: 5, active: 3, recovery: 12, dmg: 10, hitbox: { x: 22, y: 38, w: 32, h: 12 } },
                special: { startup: 12, active: 6, recovery: 22, dmg: 18, hitbox: { x: -20, y: -8, w: 100, h: 54 }, effect: 'push' }
            }
        }
    };

    // Selection defaults
    let selected = { p1: 'alex', p2: 'beth', stage: 'cafe' };

    // Simple Actor class
    class Actor {
        constructor(def, x, facing = 1, control = 'human') {
            this.def = def; this.x = x; this.y = FLOOR; this.vx = 0; this.vy = 0;
            this.facing = facing; this.onGround = true;
            this.state = 'idle'; this.actionTimer = 0; this.currentMove = null; this.movePhase = null;
            this.hurtTimer = 0; this.health = MAX_HEALTH; this.control = control; this.wins = 0;
        }
        width() { return this.def.w * this.def.scale; }
        height() { return this.def.h * this.def.scale; }
        center() { return this.x + this.width() / 2; }

        update(dt, opponent) {
            // dt is scaled delta (ms * timeScale). Physics: convert ms -> seconds factor if desired.
            const seconds = dt / 16.6667; // rough scaling to keep behavior stable
            this.vy += 0.9 * seconds;
            this.y += this.vy * seconds;
            if (this.y >= FLOOR) { this.y = FLOOR; this.vy = 0; this.onGround = true; } else this.onGround = false;

            // Control
            if (this.control === 'human') this._updateHuman();
            else this._updateAI(opponent);

            this.x += this.vx * seconds;
            this.x = Math.max(20, Math.min(WIDTH - 20 - this.width(), this.x));

            if (this.actionTimer > 0) this.actionTimer -= 1 * seconds;
            if (this.hurtTimer > 0) this.hurtTimer -= 1 * seconds;
            if (opponent) this.facing = opponent.center() > this.center() ? 1 : -1;
        }

        _updateHuman() {
            const mapping = (this === players[0]) ? humanControls.p1 : humanControls.p2;
            const busy = this.actionTimer > 0 || this.hurtTimer > 0;
            if (!busy) {
                if (keys[mapping.left]) { this.vx = -this.def.speed; this.state = 'walk'; }
                else if (keys[mapping.right]) { this.vx = this.def.speed; this.state = 'walk'; }
                else { this.vx = 0; if (this.onGround) this.state = 'idle'; }
                if (keys[mapping.jump] && this.onGround) { this.vy = this.def.jump; this.onGround = false; this.state = 'jump'; }

                if (keys[mapping.punch]) this.tryMove('punch');
                if (keys[mapping.kick]) this.tryMove('kick');
                if (keys[mapping.special]) this.tryMove('special');
            } else {
                this.vx *= 0.6;
            }
        }

        _updateAI(opponent) {
            const dist = opponent.center() - this.center();
            if (Math.abs(dist) > 220) { this.vx = this.def.speed * Math.sign(dist); this.state = 'walk'; }
            else { this.vx = 0; if (Math.random() < 0.02 && this.actionTimer <= 0) this.tryMove('punch'); }
        }

        tryMove(key) {
            if (this.actionTimer > 0 || this.hurtTimer > 0) return false;
            const m = this.def.moves[key]; if (!m) return false;
            this.currentMove = m; this.actionTimer = m.startup + m.active + m.recovery;
            this.movePhase = { phase: 'startup', timer: m.startup, didHit: false }; this.state = key === 'kick' ? 'kick_start' : 'attack_start';
            return true;
        }

        checkMoveFrames() {
            if (!this.currentMove) return null;
            if (this.actionTimer <= this.currentMove.recovery) { this.movePhase.phase = 'recovery'; this.state = 'recovery'; return null; }
            const total = this.currentMove.startup + this.currentMove.active + this.currentMove.recovery;
            const elapsed = total - this.actionTimer;
            if (elapsed < this.currentMove.startup) { this.movePhase.phase = 'startup'; return null; }
            const activeElapsed = elapsed - this.currentMove.startup;
            if (activeElapsed < this.currentMove.active) {
                this.movePhase.phase = 'active';
                this.state = 'attack_active';
                if (!this.movePhase.didHit) { this.movePhase.didHit = true; return this.currentMove; }
                return null;
            }
            return null;
        }

        receiveHit(move, attacker) {
            if (this.hurtTimer > 0) return;
            this.health = Math.max(0, this.health - move.dmg);
            this.hurtTimer = 20;
            this.state = 'hurt';
            this.vx = 6 * (this.x < attacker.x ? -1 : 1);
            this.vy = -6;
        }

        getHitboxForMove(move) {
            if (!move) return null;
            const hb = move.hitbox;
            const w = this.width(), h = this.height();
            const ox = (this.facing === 1) ? hb.x : -(hb.x + hb.w);
            const x = this.x + (w / 2) + ox;
            const y = this.y - h + 10 + hb.y;
            return { x: x, y: y, w: hb.w, h: hb.h };
        }
        getHurtbox() {
            const w = this.width(), h = this.height();
            const x = this.x, y = this.y - h + 10;
            return { x: x, y: y, w: w, h: h };
        }

        draw(ctx) {
            const w = this.width(), h = this.height();
            const drawX = this.x, drawY = this.y - h + 10;
            ctx.save();
            if (this.facing === -1) {
                ctx.translate(drawX + w / 2, 0); ctx.scale(-1, 1); ctx.translate(-drawX - w / 2, 0);
            }
            // Visual variations per state
            let color = (this === players[0]) ? '#6ad' : '#da8';
            ctx.fillStyle = color;
            roundedRect(ctx, drawX, drawY, w, h, 8); ctx.fill();

            // small accents for attacks/specials
            if (this.state.includes('attack')) { ctx.fillStyle = '#f25'; ctx.fillRect(drawX + w * 0.55, drawY + h * 0.25, w * 0.35, h * 0.12); }
            if (this.state === 'kick_active') { ctx.fillStyle = '#f25'; ctx.fillRect(drawX + w * 0.5, drawY + h * 0.75, w * 0.45, h * 0.08); }
            // name
            ctx.fillStyle = '#fff'; ctx.font = '14px monospace'; ctx.fillText(this.def.name, drawX, drawY - 8);
            ctx.restore();
            // health bar above actor (debug small)
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(drawX, drawY - 18, 60, 6);
            ctx.fillStyle = 'lime'; ctx.fillRect(drawX, drawY - 18, 60 * (this.health / MAX_HEALTH), 6);
        }
    }

    // Helpers
    function roundedRect(ctx, x, y, w, h, r) {
        ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    function rectsIntersect(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

    // Controls
    const humanControls = {
        p1: { left: 'arrowleft', right: 'arrowright', jump: 'arrowup', punch: 'k', kick: 'l', special: ';' },
        p2: { left: 'a', right: 'd', jump: 'w', punch: 'f', kick: 'g', special: 'h' }
    };

    // Game runtime containers
    const players = [];
    let currentStageKey = 'cafe';

    // Selection UI population
    function populateSelect() {
        p1Opts.innerHTML = ''; p2Opts.innerHTML = ''; stageOpts.innerHTML = '';
        Object.keys(characters).forEach(k => {
            const el1 = document.createElement('div'); el1.className = 'option'; el1.textContent = characters[k].name; el1.dataset.id = k;
            if (k === selected.p1) el1.classList.add('selected');
            el1.addEventListener('click', () => { selected.p1 = k; refreshSelect(); });
            p1Opts.appendChild(el1);

            const el2 = document.createElement('div'); el2.className = 'option'; el2.textContent = characters[k].name; el2.dataset.id = k;
            if (k === selected.p2) el2.classList.add('selected');
            el2.addEventListener('click', () => { selected.p2 = k; refreshSelect(); });
            p2Opts.appendChild(el2);
        });
        Object.keys(stages).forEach(k => {
            const el = document.createElement('div'); el.className = 'option'; el.textContent = stages[k].name; el.dataset.id = k;
            if (k === selected.stage) el.classList.add('selected');
            el.addEventListener('click', () => { selected.stage = k; refreshSelect(); });
            stageOpts.appendChild(el);
        });
    }
    function refreshSelect() {
        p1Opts.querySelectorAll('.option').forEach(o => o.classList.toggle('selected', o.dataset.id === selected.p1));
        p2Opts.querySelectorAll('.option').forEach(o => o.classList.toggle('selected', o.dataset.id === selected.p2));
        stageOpts.querySelectorAll('.option').forEach(o => o.classList.toggle('selected', o.dataset.id === selected.stage));
    }

    // Match lifecycle
    function startFight(useAIForP2 = false) {
        gameState = 'fight'; matchActive = true;
        currentStageKey = selected.stage;
        players.length = 0;
        const p1 = new Actor(characters[selected.p1], 140, 1, 'human');
        const p2 = new Actor(characters[selected.p2], WIDTH - 220, -1, useAIForP2 ? 'ai' : 'human');
        players.push(p1, p2);
        // reset wins only at the start of a new match
        p1.wins = 0; p2.wins = 0;
        round = 1; roundOver = false; roundTimer = ROUND_DURATION;
        createHUD();
        hud.p1Name.textContent = p1.def.name; hud.p2Name.textContent = p2.def.name;
        hud.p1Bar.style.width = '100%'; hud.p2Bar.style.width = '100%';
        hud.round.textContent = `Round ${round}`;
        menuOverlay.style.display = 'none';
        splashOverlay.style.display = 'none';
        // camera centering etc handled in render
    }

    function startRound() {
        roundOver = false;
        // reset positions & health only for round start
        players[0].x = 140; players[0].y = FLOOR; players[0].health = MAX_HEALTH; players[0].vx = 0; players[0].vy = 0;
        players[1].x = WIDTH - 220; players[1].y = FLOOR; players[1].health = MAX_HEALTH; players[1].vx = 0; players[1].vy = 0;
        roundTimer = ROUND_DURATION;
        timeScale = timeScaleTarget = 1; slowMoWallTimer = 0;
    }

    function awardRound(winner) {
        // called only once per round (guarded externally)
        winner.wins++;
        // update HUD rounds (simple text showing wins)
        if (hud) { hud.p1Bar.style.width = `${(players[0].health / MAX_HEALTH) * 100}%`; hud.p2Bar.style.width = `${(players[1].health / MAX_HEALTH) * 100}%`; }
        // if match over
        if (winner.wins >= ROUNDS_TO_WIN) {
            matchActive = false;
            gameState = 'matchWin';
            showWinAnimation(`${winner.def.name} wins the match!`);
            setTimeout(() => {
                destroyHUD();
                gameState = 'select';
                menuOverlay.style.display = 'flex';
                populateSelect();
            }, 2200);
            return;
        }
        // continue match: increment round once, start next round after brief pause
        round++;
        if (hud) hud.round.textContent = `Round ${round}`;
        setTimeout(() => startRound(), 900);
    }

    // Round-end routes
    function triggerKOSlowMoAndAward(winner) {
        // Initiate slow motion and KO splash, then award after short real-time delay
        timeScaleTarget = 0.12; slowMoWallTimer = 600; // ms real time slow-mo
        koTextEl.style.display = 'block'; koTextEl.style.opacity = '1';
        setTimeout(() => {
            koTextEl.style.display = 'none';
            timeScaleTarget = 1;
            awardRound(winner);
        }, 700);
    }

    function endRoundByKO() {
        if (roundOver) return;
        roundOver = true;
        // Determine winner by remaining health (either 0 or tie-break)
        const winner = players[0].health > players[1].health ? players[0] : players[1];
        triggerKOSlowMoAndAward(winner);
    }

    function endRoundByTime() {
        if (roundOver) return;
        roundOver = true;
        const winner = players[0].health >= players[1].health ? players[0] : players[1];
        // simple time-over splash (no slow-mo)
        awardRound(winner);
    }

    // KO splash animation helper (text scale)
    function renderKOText(ctx) {
        if (koTextEl.style.display === 'none') return;
        // koTextEl is a DOM element; we rely on CSS sizing. For simplicity we keep DOM visible as setTimeout handles removal.
    }

    // Loop update & render
    let debugFrame = 0;
    function loop(now = performance.now()) {
        const rawDt = now - last; last = now;
        // smoothly approach timeScaleTarget
        if (Math.abs(timeScale - timeScaleTarget) > 0.001) timeScale += (timeScaleTarget - timeScale) * 0.18;
        const scaledDt = rawDt * timeScale;

        update(scaledDt, rawDt);
        render();

        requestAnimationFrame(loop);
    }

    function update(dt, rawDt) {
        // dt is scaled, rawDt is real ms
        if (gameState === 'fight') {
            // update players with scaled dt
            players.forEach(p => p.update(dt, players.find(q => q !== p)));

            // move resolution & hit detection
            players.forEach(attacker => {
                const defender = players.find(p => p !== attacker);
                const move = attacker.checkMoveFrames();
                if (move) {
                    const hb = attacker.getHitboxForMove(move);
                    const db = defender.getHurtbox();
                    if (hb && rectsIntersect(hb, db)) {
                        defender.receiveHit(move, attacker);
                    }
                }
            });

            // hud updates
            if (hud) {
                hud.p1Bar.style.width = `${(players[0].health / MAX_HEALTH) * 100}%`;
                hud.p2Bar.style.width = `${(players[1].health / MAX_HEALTH) * 100}%`;
            }

            // KO detection (single guarded path)
            if (!roundOver && players.some(p => p.health <= 0)) {
                endRoundByKO();
            }

            // round timer using wall clock (rawDt)
            if (!roundOver) {
                roundTimer -= rawDt / 1000;
                if (roundTimer <= 0) endRoundByTime();
                if (hud) hud.timer.textContent = Math.max(0, Math.floor(roundTimer));
            }

            // slow-mo wall clock timer
            if (slowMoWallTimer > 0) {
                slowMoWallTimer -= rawDt;
                if (slowMoWallTimer <= 0) timeScaleTarget = 1;
            }
        }

        // Splash blinking
        if (gameState === 'splash') {
            // blink insert coin
            if (!insertCoinEl) return;
            const t = performance.now();
            insertCoinEl.style.opacity = (Math.floor(t / 400) % 2) ? '1' : '0.16';
        }
    }

    function render() {
        // clear
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        // stage background
        const stage = stages[currentStageKey] || stages.cafe;
        // parallax drawing based on camera midpoint of players
        let camX = WIDTH / 2;
        if (players.length === 2) camX = (players[0].center() + players[1].center()) / 2;
        stage.layers.forEach(layer => {
            const offset = (camX * layer.scroll) % WIDTH;
            ctx.fillStyle = layer.color;
            ctx.fillRect(-offset, layer.y, WIDTH, HEIGHT - layer.y);
            ctx.fillRect(-offset + WIDTH, layer.y, WIDTH, HEIGHT - layer.y);
        });
        // floor
        ctx.fillStyle = stage.floorColor;
        ctx.fillRect(0, FLOOR + 2, WIDTH, HEIGHT - FLOOR);

        // draw players in order
        if (players.length) {
            const sorted = players.slice().sort((a, b) => a.x - b.x);
            sorted.forEach(p => p.draw(ctx));
        }

        // draw active hitboxes (debug)
        if (gameState === 'fight') {
            players.forEach(p => {
                const mv = p.currentMove && p.movePhase && p.movePhase.phase === 'active' ? p.currentMove : null;
                const hb = p.getHitboxForMove(mv);
                if (hb) {
                    ctx.strokeStyle = "rgba(255,0,0,0.9)"; ctx.lineWidth = 2; ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
                }
            });
        }

        // Title/menus messages
        if (gameState === 'splash') {
            // handled by DOM overlay
        } else if (gameState === 'select') {
            // menu overlay DOM shows selections
        } else if (gameState === 'matchWin') {
            // KO/match finish handled by DOM
        }
    }

    // Splash/menu wiring
    function showSplash() {
        splashOverlay.style.display = 'flex';
        menuOverlay.style.display = 'none';
        // listen for Enter to go to menu
        function onEnter(e) {
            if (e.key.toLowerCase() === 'enter') {
                window.removeEventListener('keydown', onEnter);
                splashOverlay.style.display = 'none';
                showMenu();
            }
        }
        window.addEventListener('keydown', onEnter);
    }

    function showMenu() {
        gameState = 'select';
        menuOverlay.style.display = 'flex';
        populateSelect();
    }

    // Win animation for match end
    function showWinAnimation(text) {
        const txt = document.createElement('div');
        txt.className = 'ko-text';
        txt.style.fontSize = '48px';
        txt.style.color = '#ffd26a';
        txt.style.left = '50%';
        txt.style.top = '40%';
        txt.style.transform = 'translate(-50%,-50%) scale(1)';
        txt.textContent = text;
        document.body.appendChild(txt);
        setTimeout(() => { txt.style.transition = 'transform 0.35s ease-out, opacity 0.35s'; txt.style.transform = 'translate(-50%,-50%) scale(1.08)'; }, 20);
        setTimeout(() => { txt.style.opacity = '0'; }, 1900);
        setTimeout(() => { try { document.body.removeChild(txt); } catch (e) { } }, 2400);
    }

    // Initial interactions
    // Enter on splash -> menu; Enter on menu -> start fight
    window.addEventListener('keydown', (e) => {
        if (gameState === 'select' && e.key.toLowerCase() === 'enter') {
            // start match with both human players; change if you want AI
            startFight(false);
        }
    });

    // Expose a small dev helper: press Esc to go back to select (destroy HUD)
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // abort match and return to select
            destroyHUD();
            menuOverlay.style.display = 'flex';
            splashOverlay.style.display = 'none';
            gameState = 'select';
            players.length = 0;
            populateSelect();
        }
    });

    // Initialize
    populateSelect();
    showSplash();
    last = performance.now();
    requestAnimationFrame(loop);

    // Export for console tweaks
    window.RetroPunch = { players, characters, stages, startFight, startRound, createHUD, destroyHUD };

})();
