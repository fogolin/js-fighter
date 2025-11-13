// Retro Punch - AI enhancements: state machine, strafing/backdash, blocking, punish windows, special + projectile
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
        canvas.style.width = WIDTH + 'px';
        canvas.style.height = HEIGHT + 'px';
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // UI elements
    const splashOverlay = document.getElementById('splashOverlay');
    const insertCoinEl = document.getElementById('insertCoin');
    const menuOverlay = document.getElementById('menuOverlay');
    const p1Opts = document.getElementById('p1-opts');
    const p2Opts = document.getElementById('p2-opts');
    const stageOpts = document.getElementById('stage-opts');
    const aiToggleEl = document.getElementById('aiToggle');

    // Input
    const keys = {};
    window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

    // Timing
    let last = performance.now();

    // Time-scaling
    let timeScale = 1;
    let timeScaleTarget = 1;
    let slowMoWallTimer = 0;

    // Game state
    let gameState = 'splash'; // splash -> select -> fight -> matchWin
    let round = 1;
    let roundOver = false;
    let matchActive = false;
    let roundTimer = ROUND_DURATION; // seconds

    // splash
    let canvasSplash = null;

    // HUD
    let hud = null;
    function createHUD() {
        if (hud) return;
        hud = document.createElement('div');
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

    // Stages and characters
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

    const characters = {
        alex: {
            name: "Alex", w: 48, h: 64, scale: 1.6, speed: 4, jump: -14,
            moves: {
                punch: { startup: 3, active: 4, recovery: 8, dmg: 8, hitbox: { x: 28, y: 14, w: 26, h: 16 } },
                kick: { startup: 4, active: 4, recovery: 10, dmg: 12, hitbox: { x: 24, y: 36, w: 36, h: 14 } },
                special: { startup: 10, active: 8, recovery: 26, dmg: 16, hitbox: { x: 0, y: -10, w: 24, h: 24 }, effect: 'projectile', proj: { w: 18, h: 10, speed: 9, dmg: 10 }, cooldown: 4800 }
            }
        },
        beth: {
            name: "Beth", w: 46, h: 62, scale: 1.8, speed: 3.6, jump: -13,
            moves: {
                punch: { startup: 2, active: 3, recovery: 10, dmg: 6, hitbox: { x: 26, y: 12, w: 24, h: 14 } },
                kick: { startup: 5, active: 3, recovery: 12, dmg: 10, hitbox: { x: 22, y: 38, w: 32, h: 12 } },
                special: { startup: 12, active: 8, recovery: 28, dmg: 18, hitbox: { x: -20, y: -8, w: 100, h: 54 }, effect: 'push', cooldown: 6000 }
            }
        }
    };

    // Selection and AI flag
    let selected = { p1: 'alex', p2: 'beth', stage: 'cafe' };
    let p2IsAI = false;

    // Expose debug helper
    window.RetroPunch = window.RetroPunch || {};
    window.RetroPunch.getAIState = () => ({ p2IsAI });

    // AI toggle UI rendering
    function renderAIToggle() {
        if (!aiToggleEl) return;
        aiToggleEl.textContent = p2IsAI ? 'AI' : 'Human';
        aiToggleEl.classList.toggle('active', p2IsAI);
    }
    if (aiToggleEl) {
        aiToggleEl.addEventListener('click', () => {
            p2IsAI = !p2IsAI; renderAIToggle();
        });
        renderAIToggle();
    }

    // Projectiles container
    const projectiles = [];

    // Actor class with additional blocking/punish fields & special cooldown
    class Actor {
        constructor(def, x, facing = 1, control = 'human') {
            this.def = def;
            this.x = x; this.y = FLOOR; this.vx = 0; this.vy = 0;
            this.facing = facing; this.onGround = true;
            this.state = 'idle';
            this.actionTimer = 0; this.currentMove = null; this.movePhase = null;
            this.hurtTimer = 0; this.health = MAX_HEALTH; this.control = control; this.wins = 0;
            // AI-related runtime
            this.blocking = false;            // currently blocking
            this.lastHitTime = 0;             // ms since last took damage (for punish)
            this.punishWindow = 300;          // ms window after blocking to punish
            this.specialCooldown = 0;         // ms remaining cooldown for special
            this.stunTimer = 0;
            // AI state machine
            this.aiState = 'idle';            // idle | pressure | attack | retreat
            this.aiStateTimer = 0;
        }

        width() { return this.def.w * this.def.scale; }
        height() { return this.def.h * this.def.scale; }
        center() { return this.x + this.width() / 2; }

        update(dt, opponent) {
            const seconds = dt / 16.6667;
            // physics
            this.vy += 0.9 * seconds;
            this.y += this.vy * seconds;
            if (this.y >= FLOOR) { this.y = FLOOR; this.vy = 0; this.onGround = true; } else this.onGround = false;

            // timers
            if (this.actionTimer > 0) this.actionTimer -= dt;
            if (this.hurtTimer > 0) this.hurtTimer -= dt;
            if (this.stunTimer > 0) this.stunTimer -= dt;
            if (this.specialCooldown > 0) this.specialCooldown -= dt;
            if (this.lastHitTime > 0) this.lastHitTime -= dt;
            if (this.aiStateTimer > 0) this.aiStateTimer -= dt;

            // control
            if (this.control === 'human') this._updateHuman();
            else this._updateAI(opponent);

            this.x += this.vx * seconds;
            this.x = Math.max(20, Math.min(WIDTH - 20 - this.width(), this.x));

            // face opponent
            if (opponent) this.facing = opponent.center() > this.center() ? 1 : -1;

            // blocking resets when not holding
            if (this.blocking && !this._shouldKeepBlocking) this.blocking = false;
        }

        _updateHuman() {
            const mapping = (this === players[0]) ? humanControls.p1 : humanControls.p2;
            const busy = this.actionTimer > 0 || this.hurtTimer > 0 || this.stunTimer > 0;
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

        // AI: state machine with simple behavior
        _updateAI(opponent) {
            // state transitions based on spacing and health ratio
            const dist = opponent.center() - this.center();
            const absd = Math.abs(dist);
            const healthRatio = this.health / Math.max(1, opponent.health);

            // small punish logic: if opponent just blocked and left punish window exposed -> attack
            const opponentBlocking = opponent.blocking;
            const opponentPunishable = opponent.lastHitTime > 0 && opponent.lastHitTime < opponent.punishWindow;

            // Transition logic
            if (this.aiStateTimer <= 0) {
                if (absd > 250) { this.aiState = 'idle'; this.aiStateTimer = 800 + Math.random() * 700; }
                else if (absd > 120) { this.aiState = 'pressure'; this.aiStateTimer = 800 + Math.random() * 600; }
                else {
                    // close range
                    if (healthRatio < 0.9 && Math.random() < 0.6) this.aiState = 'attack';
                    else this.aiState = (Math.random() < 0.5) ? 'attack' : 'pressure';
                    this.aiStateTimer = 600 + Math.random() * 800;
                }
            }

            // Behavior per state
            if (this.aiState === 'idle') {
                this.vx = 0;
                // small random approach occasionally
                if (absd > 260 && Math.random() < 0.01) this.vx = this.def.speed * Math.sign(dist);
                // occasionally throw projectile if available and mid-range
                if (absd > 140 && absd < 320 && this.specialCooldown <= 0 && Math.random() < 0.02) {
                    this.tryMove('special');
                }
            }

            else if (this.aiState === 'pressure') {
                // approach but keep right spacing; occasional strafing
                const desired = 120; // preferred pressure distance
                if (absd > desired + 20) this.vx = this.def.speed * Math.sign(dist);
                else if (absd < desired - 20) this.vx = -this.def.speed * Math.sign(dist); // step back slightly
                else {
                    // small strafe left/right to bait
                    if (Math.random() < 0.01) this.vx = (Math.random() < 0.5 ? -1 : 1) * this.def.speed * 0.8;
                    else this.vx = 0;
                }
                // attempt to poke
                if (absd < 160 && this.actionTimer <= 0 && Math.random() < 0.15) this.tryMove('punch');
                if (absd < 200 && this.actionTimer <= 0 && Math.random() < 0.06) this.tryMove('kick');
                // use special as a pressure tool occasionally, if available
                if (absd > 100 && absd < 220 && this.specialCooldown <= 0 && Math.random() < 0.04) this.tryMove('special');
            }

            else if (this.aiState === 'attack') {
                // aggressive: close and commit; but if opponent is blocking, try backdash or punish
                if (opponentBlocking) {
                    // backdash / strafing to avoid a hard punish
                    if (Math.random() < 0.6) {
                        // backdash: quick opposite direction step
                        this.vx = -this.def.speed * Math.sign(dist) * 1.5;
                        // small chance to attempt a spaced special
                        if (this.specialCooldown <= 0 && Math.random() < 0.05) this.tryMove('special');
                    } else {
                        // attempt a low risk poke
                        if (this.actionTimer <= 0 && Math.random() < 0.4) this.tryMove('punch');
                    }
                } else {
                    // commit to hit
                    if (absd > 70) this.vx = this.def.speed * Math.sign(dist);
                    else this.vx = 0;
                    if (this.actionTimer <= 0) {
                        if (absd < 70 && Math.random() < 0.7) this.tryMove('kick'); // stronger close attack
                        else if (Math.random() < 0.5) this.tryMove('punch');
                    }
                }
            }

            else if (this.aiState === 'retreat') {
                // keep distance, kite, or throw projectiles
                this.vx = -this.def.speed * Math.sign(dist);
                if (absd > 220 && this.specialCooldown <= 0 && Math.random() < 0.08) this.tryMove('special');
                if (Math.random() < 0.02) this.aiState = 'pressure';
            }

            // Blocking decision: if being pressured and about to be hit, try to block
            // We'll set a simple rule: if opponent is in active attack and close, enable blocking
            if (opponent.currentMove && opponent.movePhase && opponent.movePhase.phase === 'active') {
                const ophb = opponent.getHitboxForMove(opponent.currentMove);
                const hb = this.getHurtbox();
                if (ophb && rectsIntersect(ophb, hb) && Math.random() < 0.8) {
                    this.blocking = true;
                    this._shouldKeepBlocking = true;
                }
            } else {
                this._shouldKeepBlocking = false;
            }

            // Punish window: if opponent recently blocked and is punishable
            if (opponent.lastHitTime > 0 && opponent.lastHitTime < opponent.punishWindow && this.actionTimer <= 0 && Math.random() < 0.7) {
                // punish with quick attack
                this.tryMove('punch');
            }
        }

        tryMove(key) {
            if (this.actionTimer > 0 || this.hurtTimer > 0 || this.stunTimer > 0) return false;
            const m = this.def.moves[key]; if (!m) return false;
            // special move throttle via specialCooldown
            if (m.effect === 'projectile' && this.specialCooldown > 0) return false;

            this.currentMove = m;
            // scale timers to milliseconds for consistency
            this.actionTimer = (m.startup + m.active + m.recovery) * 16; // approximate ms
            this.movePhase = { phase: 'startup', timer: m.startup * 16, didHit: false };
            this.state = key === 'kick' ? 'kick_start' : 'attack_start';

            // if special with projectile, set cooldown now
            if (m.effect === 'projectile') {
                this.specialCooldown = (m.cooldown || 4000);
            }
            return true;
        }

        checkMoveFrames() {
            if (!this.currentMove) return null;
            // actionTimer counts ms; compute total in ms
            const move = this.currentMove;
            const total = (move.startup + move.active + move.recovery) * 16;
            const elapsed = total - Math.max(0, this.actionTimer);
            if (elapsed < move.startup * 16) { this.movePhase.phase = 'startup'; return null; }
            const activeElapsed = elapsed - move.startup * 16;
            if (activeElapsed < move.active * 16) {
                this.movePhase.phase = 'active';
                this.state = 'attack_active';
                if (!this.movePhase.didHit) { this.movePhase.didHit = true; return move; }
                return null;
            }
            return null;
        }

        receiveHit(move, attacker) {
            if (this.hurtTimer > 0) return;
            // if blocking and hitbox overlaps low/mid/high we reduce damage heavily and set lastHitTime for punish
            if (this.blocking) {
                // reduce damage and set punishable window
                this.health = Math.max(0, this.health - Math.max(1, Math.floor(move.dmg * 0.25)));
                this.lastHitTime = this.punishWindow; // starts punish window
            } else {
                this.health = Math.max(0, this.health - move.dmg);
            }
            this.hurtTimer = 300; // ms of hitstun
            this.stunTimer = 300;
            this.state = 'hurt';
            this.vx = 6 * (this.x < attacker.x ? -1 : 1);
            this.vy = -6;
            // cancel current move
            this.currentMove = null;
            this.movePhase = null;
            // stop blocking if hit through
            this.blocking = false;
        }

        // projectile spawn helper (for special projectile effect)
        spawnProjectile(projDef) {
            const dir = this.facing;
            const px = this.x + this.width() / 2 + (dir === 1 ? 24 : -24);
            const py = this.y - this.height() / 2;
            projectiles.push({
                x: px, y: py, w: projDef.w, h: projDef.h, vx: projDef.speed * dir, dmg: projDef.dmg, owner: this, ttl: 4000
            });
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
            if (this.facing === -1) { ctx.translate(drawX + w / 2, 0); ctx.scale(-1, 1); ctx.translate(-drawX - w / 2, 0); }
            let color = (this === players[0]) ? '#6ad' : '#da8';
            ctx.fillStyle = color;
            roundedRect(ctx, drawX, drawY, w, h, 8); ctx.fill();
            // blocking visual
            if (this.blocking) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(drawX, drawY, w, h); }
            // attack accent
            if (this.state.includes('attack')) { ctx.fillStyle = '#f25'; ctx.fillRect(drawX + w * 0.55, drawY + h * 0.25, w * 0.35, h * 0.12); }
            if (this.state === 'kick_active') { ctx.fillStyle = '#f25'; ctx.fillRect(drawX + w * 0.5, drawY + h * 0.75, w * 0.45, h * 0.08); }
            // name
            ctx.fillStyle = '#fff'; ctx.font = '14px monospace'; ctx.fillText(this.def.name, drawX, drawY - 8);
            ctx.restore();
            // small health bar above actor
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(drawX, drawY - 18, 60, 6);
            ctx.fillStyle = 'lime'; ctx.fillRect(drawX, drawY - 18, 60 * (this.health / MAX_HEALTH), 6);
        }
    }

    function roundedRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function rectsIntersect(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

    const humanControls = {
        p1: { left: 'arrowleft', right: 'arrowright', jump: 'arrowup', punch: 'k', kick: 'l', special: ';' },
        p2: { left: 'a', right: 'd', jump: 'w', punch: 'f', kick: 'g', special: 'h' }
    };

    const players = [];
    let currentStageKey = 'cafe';

    // Projectiles update/draw
    function updateProjectiles(dt) {
        for (let proj of projectiles) {
            proj.x += proj.vx * (dt / 16.6667);
            proj.y += proj.vy * (dt / 16.6667);
            proj.ttl -= dt;
        }
        // collision with players
        for (let proj of projectiles.slice()) {
            if (proj.ttl <= 0) { projectiles.splice(projectiles.indexOf(proj), 1); continue; }
            for (let p of players) {
                if (p === proj.owner) continue;
                const hb = p.getHurtbox();
                const r = { x: proj.x, y: proj.y, w: proj.w, h: proj.h };
                if (rectsIntersect(hb, r)) {
                    // apply damage (allow blocking to reduce)
                    if (p.blocking) p.health = Math.max(0, p.health - Math.floor(proj.dmg * 0.25));
                    else p.health = Math.max(0, p.health - proj.dmg);
                    p.hurtTimer = 200; p.stunTimer = 200; p.state = 'hurt';
                    // remove projectile
                    projectiles.splice(projectiles.indexOf(proj), 1);
                    break;
                }
            }
        }
    }

    // Selection UI
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
        renderAIToggle();
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
        const p2Control = p2IsAI ? 'ai' : 'human';
        const p2 = new Actor(characters[selected.p2], WIDTH - 220, -1, p2Control);
        players.push(p1, p2);
        p1.wins = 0; p2.wins = 0;
        round = 1; roundOver = false; roundTimer = ROUND_DURATION;
        createHUD();
        hud.p1Name.textContent = p1.def.name; hud.p2Name.textContent = p2.def.name;
        hud.p1Bar.style.width = '100%'; hud.p2Bar.style.width = '100%';
        hud.round.textContent = `Round ${round}`;
        menuOverlay.style.display = 'none';
        splashOverlay.style.display = 'none';
        setTimeout(() => startRound(), 220);
    }

    function startRound() {
        roundOver = false;
        projectiles.length = 0;
        players[0].x = 140; players[0].y = FLOOR; players[0].health = MAX_HEALTH; players[0].vx = 0; players[0].vy = 0;
        players[1].x = WIDTH - 220; players[1].y = FLOOR; players[1].health = MAX_HEALTH; players[1].vx = 0; players[1].vy = 0;
        // reset AI runtime states
        players.forEach(p => {
            p.blocking = false; p.lastHitTime = 0; p.specialCooldown = 0; p.aiState = 'idle'; p.aiStateTimer = 0;
        });
        roundTimer = ROUND_DURATION;
        timeScale = timeScaleTarget = 1; slowMoWallTimer = 0;
    }

    function awardRound(winner) {
        winner.wins++;
        if (hud) {
            hud.p1Bar.style.width = `${(players[0].health / MAX_HEALTH) * 100}%`;
            hud.p2Bar.style.width = `${(players[1].health / MAX_HEALTH) * 100}%`;
        }
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
        round++;
        if (hud) hud.round.textContent = `Round ${round}`;
        setTimeout(() => startRound(), 900);
    }

    // Canvas splash helpers
    function createCanvasSplash(type, ownerName) {
        canvasSplash = { type, text: type === 'KO' ? 'K O !' : 'TIME', sub: type === 'KO' ? ownerName + ' wins' : 'Time is up', alpha: 1, scale: 0.4, ttl: 1200, confetti: [] };
        const count = type === 'KO' ? 30 : 12;
        for (let i = 0; i < count; i++) {
            canvasSplash.confetti.push({
                x: WIDTH / 2 + (Math.random() * 400 - 200),
                y: HEIGHT * 0.38 + (Math.random() * 40 - 20),
                vx: (Math.random() * 6 - 3),
                vy: (Math.random() * -6 - 2),
                color: i % 3 === 0 ? '#ffd26a' : (i % 3 === 1 ? '#4ad04a' : '#f46'),
                ttl: 800 + Math.random() * 600
            });
        }
    }

    function triggerKOSlowMoAndAward(winner) {
        timeScaleTarget = 0.12; slowMoWallTimer = 600;
        createCanvasSplash('KO', winner.def.name);
        setTimeout(() => {
            timeScaleTarget = 1;
            canvasSplash = null;
            awardRound(winner);
        }, 720);
    }
    function triggerTimeOverAndAward(winner) {
        createCanvasSplash('TIME', winner.def.name);
        setTimeout(() => {
            canvasSplash = null;
            awardRound(winner);
        }, 900);
    }

    function endRoundByKO() {
        if (roundOver) return;
        roundOver = true;
        const winner = players[0].health > players[1].health ? players[0] : players[1];
        triggerKOSlowMoAndAward(winner);
    }
    function endRoundByTime() {
        if (roundOver) return;
        roundOver = true;
        const winner = players[0].health >= players[1].health ? players[0] : players[1];
        triggerTimeOverAndAward(winner);
    }

    // main loop
    function loop(now = performance.now()) {
        const rawDt = now - last; last = now;
        if (Math.abs(timeScale - timeScaleTarget) > 0.001) timeScale += (timeScaleTarget - timeScale) * 0.18;
        const scaledDt = rawDt * timeScale;
        update(scaledDt, rawDt);
        render();
        requestAnimationFrame(loop);
    }

    function update(dt, rawDt) {
        if (gameState === 'fight') {
            players.forEach(p => p.update(dt, players.find(q => q !== p)));

            // attack resolution
            players.forEach(attacker => {
                const defender = players.find(p => p !== attacker);
                const move = attacker.checkMoveFrames();
                if (move) {
                    // if special is projectile spawn, do it when active starts
                    if (move.effect === 'projectile' && attacker.movePhase && attacker.movePhase.phase === 'active' && !attacker.movePhase.didSpawn) {
                        attacker.movePhase.didSpawn = true;
                        // spawn projectile defined in def.proj
                        if (attacker.def.moves.special && attacker.def.moves.special.proj) {
                            attacker.spawnProjectile(attacker.def.moves.special.proj);
                        }
                    }

                    const hb = attacker.getHitboxForMove(move);
                    const db = defender.getHurtbox();
                    if (hb && rectsIntersect(hb, db)) {
                        // if defender blocking, apply partial damage
                        if (defender.blocking) {
                            defender.receiveHit({ ...move, dmg: Math.max(1, Math.floor(move.dmg * 0.25)) }, attacker);
                        } else {
                            defender.receiveHit(move, attacker);
                        }
                    }
                }
            });

            // update projectiles
            updateProjectiles(dt);

            // update HUD
            if (hud) {
                hud.p1Bar.style.width = `${(players[0].health / MAX_HEALTH) * 100}%`;
                hud.p2Bar.style.width = `${(players[1].health / MAX_HEALTH) * 100}%`;
            }

            // KO detection
            if (!roundOver && players.some(p => p.health <= 0)) {
                endRoundByKO();
            }

            // timer
            if (!roundOver) {
                roundTimer -= rawDt / 1000;
                if (roundTimer <= 0) endRoundByTime();
                if (hud) hud.timer.textContent = Math.max(0, Math.floor(roundTimer));
            }

            // slowMo wall clock
            if (slowMoWallTimer > 0) {
                slowMoWallTimer -= rawDt;
                if (slowMoWallTimer <= 0) timeScaleTarget = 1;
            }
        }

        if (gameState === 'splash') {
            if (insertCoinEl) {
                const t = performance.now();
                insertCoinEl.style.opacity = (Math.floor(t / 400) % 2) ? '1' : '0.16';
            }
        }

        // canvas splash update
        if (canvasSplash) {
            canvasSplash.ttl -= rawDt;
            canvasSplash.scale += (1.0 - canvasSplash.scale) * 0.08;
            for (let p of canvasSplash.confetti) {
                p.ttl -= rawDt;
                p.x += p.vx;
                p.y += p.vy + (rawDt / 1000) * 6;
                p.vy += 0.2;
            }
            canvasSplash.confetti = canvasSplash.confetti.filter(p => p.ttl > 0);
        }
    }

    function render() {
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        const stage = stages[currentStageKey] || stages.cafe;
        let camX = WIDTH / 2;
        if (players.length === 2) camX = (players[0].center() + players[1].center()) / 2;
        stage.layers.forEach(layer => {
            const offset = (camX * layer.scroll) % WIDTH;
            ctx.fillStyle = layer.color;
            ctx.fillRect(-offset, layer.y, WIDTH, HEIGHT - layer.y);
            ctx.fillRect(-offset + WIDTH, layer.y, WIDTH, HEIGHT - layer.y);
        });
        ctx.fillStyle = stage.floorColor;
        ctx.fillRect(0, FLOOR + 2, WIDTH, HEIGHT - FLOOR);

        // draw projectiles behind players
        for (let proj of projectiles) {
            ctx.fillStyle = '#ffd26a';
            ctx.fillRect(proj.x, proj.y, proj.w, proj.h);
        }

        if (players.length) {
            const sorted = players.slice().sort((a, b) => a.x - b.x);
            sorted.forEach(p => p.draw(ctx));
        }

        // debug hitboxes
        if (gameState === 'fight') {
            players.forEach(p => {
                const mv = p.currentMove && p.movePhase && p.movePhase.phase === 'active' ? p.currentMove : null;
                const hb = p.getHitboxForMove(mv);
                if (hb) {
                    ctx.strokeStyle = "rgba(255,0,0,0.9)"; ctx.lineWidth = 2; ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
                }
            });
        }

        // draw canvas splash
        if (canvasSplash) {
            const s = canvasSplash;
            ctx.save();
            for (let p of s.confetti) {
                ctx.globalAlpha = Math.max(0, Math.min(1, p.ttl / 800));
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, 6, 10);
            }
            const baseSize = s.type === 'KO' ? 120 : 86;
            const size = baseSize * (0.8 + 0.6 * s.scale);
            ctx.globalAlpha = Math.max(0, Math.min(1, s.ttl / 1200));
            ctx.fillStyle = s.type === 'KO' ? '#fff' : '#ffd26a';
            ctx.font = `bold ${Math.floor(size)}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(s.text, WIDTH / 2, HEIGHT * 0.42);
            ctx.font = `bold ${Math.floor(size * 0.22)}px monospace`;
            ctx.fillStyle = '#fff';
            ctx.fillText(s.sub, WIDTH / 2, HEIGHT * 0.42 + size * 0.6);
            ctx.restore();
        }
    }

    // Menu wiring
    function showSplash() {
        splashOverlay.style.display = 'flex';
        menuOverlay.style.display = 'none';
        function onEnter(e) {
            if (e.key.toLowerCase() === 'enter') {
                window.removeEventListener('keydown', onEnter);
                splashOverlay.style.display = 'none';
                showMenu();
            }
        }
        window.addEventListener('keydown', onEnter);
    }
    function showMenu() { gameState = 'select'; menuOverlay.style.display = 'flex'; populateSelect(); }

    function showWinAnimation(text) {
        canvasSplash = { type: 'WIN', text, sub: '', alpha: 1, scale: 0.6, ttl: 1800, confetti: [] };
        for (let i = 0; i < 24; i++) {
            canvasSplash.confetti.push({ x: WIDTH / 2 + (Math.random() * 500 - 250), y: HEIGHT * 0.4 + (Math.random() * 60 - 30), vx: (Math.random() * 8 - 4), vy: (Math.random() * -8 - 2), color: i % 3 === 0 ? '#ffd26a' : (i % 3 === 1 ? '#4ad04a' : '#f46'), ttl: 1000 + Math.random() * 1000 });
        }
        setTimeout(() => { canvasSplash = null; }, 1800);
    }

    // Enter to start
    window.addEventListener('keydown', (e) => {
        if (gameState === 'select' && e.key.toLowerCase() === 'enter') {
            startFight();
        }
    });

    // Escape abort
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            destroyHUD();
            menuOverlay.style.display = 'flex';
            splashOverlay.style.display = 'none';
            gameState = 'select';
            players.length = 0;
            populateSelect();
        }
    });

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
        renderAIToggle();
    }
    function refreshSelect() {
        p1Opts.querySelectorAll('.option').forEach(o => o.classList.toggle('selected', o.dataset.id === selected.p1));
        p2Opts.querySelectorAll('.option').forEach(o => o.classList.toggle('selected', o.dataset.id === selected.p2));
        stageOpts.querySelectorAll('.option').forEach(o => o.classList.toggle('selected', o.dataset.id === selected.stage));
    }

    // initialize
    populateSelect();
    showSplash();
    last = performance.now();
    requestAnimationFrame(loop);

    // Expose helpers
    window.RetroPunch.startFight = startFight;
    window.RetroPunch.startRound = startRound;
    window.RetroPunch.createHUD = createHUD;
    window.RetroPunch.destroyHUD = destroyHUD;

    // move functions placed after export so references resolve
    function startFight(useAIForP2 = false) {
        gameState = 'fight'; matchActive = true;
        currentStageKey = selected.stage;
        players.length = 0;
        const p1 = new Actor(characters[selected.p1], 140, 1, 'human');
        const p2Control = p2IsAI ? 'ai' : 'human';
        const p2 = new Actor(characters[selected.p2], WIDTH - 220, -1, p2Control);
        players.push(p1, p2);
        p1.wins = 0; p2.wins = 0;
        round = 1; roundOver = false; roundTimer = ROUND_DURATION;
        createHUD();
        hud.p1Name.textContent = p1.def.name; hud.p2Name.textContent = p2.def.name;
        hud.p1Bar.style.width = '100%'; hud.p2Bar.style.width = '100%';
        hud.round.textContent = `Round ${round}`;
        menuOverlay.style.display = 'none';
        splashOverlay.style.display = 'none';
        setTimeout(() => startRound(), 220);
    }

    function startRound() {
        roundOver = false;
        projectiles.length = 0;
        players[0].x = 140; players[0].y = FLOOR; players[0].health = MAX_HEALTH; players[0].vx = 0; players[0].vy = 0;
        players[1].x = WIDTH - 220; players[1].y = FLOOR; players[1].health = MAX_HEALTH; players[1].vx = 0; players[1].vy = 0;
        players.forEach(p => {
            p.blocking = false; p.lastHitTime = 0; p.specialCooldown = 0; p.aiState = 'idle'; p.aiStateTimer = 0;
        });
        roundTimer = ROUND_DURATION;
        timeScale = timeScaleTarget = 1; slowMoWallTimer = 0;
    }

    // projectiles container defined earlier; ensure available reference
    // eslint-disable-next-line no-unused-vars
    const _ = null;
})();
