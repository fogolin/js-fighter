// Retro Punch - extended
// States: title -> select -> fight -> matchWin -> back to select
(() => {
    // CONFIG
    let WIDTH = window.innerWidth;
    let HEIGHT = window.innerHeight;
    const FLOOR_RATIO = 0.78; // floor relative to height
    let FLOOR = Math.floor(HEIGHT * FLOOR_RATIO);
    const G = 0.9; // gravity
    const MAX_HEALTH = 100;

    // Set Rounds
    const ROUNDS_TO_WIN = 2; // best of 3
    const ROUND_TIMER = 15; // seconds
    let round = 0;
    let roundOver = false;

    let timerInterval = null;

    // Canvas & ctx
    window.addEventListener('resize', () => {
        WIDTH = window.innerWidth;
        HEIGHT = window.innerHeight;
        FLOOR = Math.floor(HEIGHT * FLOOR_RATIO);
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
    });

    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    canvas.width = WIDTH; canvas.height = HEIGHT;

    // UI elements
    const p1NameEl = document.getElementById('p1-name');
    const p2NameEl = document.getElementById('p2-name');
    const p1BarEl = document.getElementById('p1-bar');
    const p2BarEl = document.getElementById('p2-bar');
    const p1RoundsEl = document.getElementById('p1-rounds');
    const p2RoundsEl = document.getElementById('p2-rounds');
    const roundText = document.getElementById('round-text');

    // INPUT
    const keys = {};
    window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; e.preventDefault(); });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; e.preventDefault(); });

    // Helper
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function rectsIntersect(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

    // Minimal asset map (optional images)
    const images = {};
    function loadImage(key, src) {
        return new Promise((res, rej) => {
            const img = new Image();
            img.onload = () => { images[key] = img; res(img); };
            img.onerror = () => res(null);
            img.src = src;
        });
    }

    // Title and selection overlays
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const panel = document.createElement('div');
    panel.className = 'panel';
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Health rounds UI
    function roundsDots(pWins) { // returns e.g., "● ○ ○"
        return Array.from({ length: ROUNDS_TO_WIN + 1 }).map((_, i) => i < pWins ? '●' : '○').join(' ');
    }

    // Parallax stage definitions
    const stages = {
        cafe: {
            name: "Local Café",
            layers: [
                { color: "#0a0f1a", y: 0, scroll: 0.1 },   // sky
                { color: "#1a2033", y: 120, scroll: 0.2 }, // distant buildings
                { color: "#24324a", y: 220, scroll: 0.4 }, // mid buildings
                { color: "#304a5a", y: 320, scroll: 0.7 }, // near props
            ],
            floorColor: "#2a2318"
        },
        park: {
            name: "City Park",
            layers: [
                { color: "#081419", y: 0, scroll: 0.1 },
                { color: "#0f2a2f", y: 140, scroll: 0.25 },
                { color: "#135a3a", y: 220, scroll: 0.5 },
                { color: "#1f7a4a", y: 310, scroll: 0.8 },
            ],
            floorColor: "#3d2a1a"
        },
        campus: {
            name: "Campus",
            layers: [
                { color: "#0b1021", y: 0, scroll: 0.1 },
                { color: "#141a36", y: 110, scroll: 0.25 },
                { color: "#2b345e", y: 210, scroll: 0.5 },
                { color: "#454e8a", y: 300, scroll: 0.85 },
            ],
            floorColor: "#222222"
        }
    };

    // Character definitions with basic action sprites (placeholder shapes)
    // Each animation has a style to draw different looks for actions
    const characters = {
        alex: {
            name: "Alex",
            w: 48, h: 64, scale: 1.7,
            speed: 10, jumpSpeed: -2,
            moves: {
                punch: { name: "Punch", startup: 3, active: 4, recovery: 8, dx: 6, dmg: 100, hitbox: { x: 28, y: 14, w: 26, h: 16 } },
                kick: { name: "Kick", startup: 4, active: 4, recovery: 10, dx: 8, dmg: 100, hitbox: { x: 24, y: 36, w: 36, h: 14 } },
                special: { name: "Rising Strike", startup: 6, active: 6, recovery: 18, dx: 0, dmg: 100, hitbox: { x: 10, y: -30, w: 50, h: 60 }, effect: "rise" }
            },
            anim: {
                idle: { style: "body", color: "#6ad", accent: "#cfe" },
                walk: { style: "bodyStride", color: "#6ad", accent: "#cfe" },
                jump: { style: "bodyJump", color: "#6ad", accent: "#cfe" },
                attack: { style: "bodyPunch", color: "#6ad", accent: "#f25" },
                kick: { style: "bodyKick", color: "#6ad", accent: "#f25" },
                hurt: { style: "bodyHurt", color: "#6ad", accent: "#f8a" },
                special: { style: "bodyUpper", color: "#6ad", accent: "#ffd26a" }
            }
        },
        beth: {
            name: "Beth",
            w: 46, h: 62, scale: 1.8,
            speed: 3.6, jumpSpeed: -13,
            moves: {
                punch: { name: "Rapid Jab", startup: 2, active: 3, recovery: 10, dx: 4, dmg: 6, hitbox: { x: 26, y: 12, w: 24, h: 14 } },
                kick: { name: "Sweep", startup: 5, active: 3, recovery: 12, dx: 10, dmg: 10, hitbox: { x: 22, y: 38, w: 32, h: 12 } },
                special: { name: "Energy Burst", startup: 12, active: 6, recovery: 22, dx: 0, dmg: 18, hitbox: { x: -20, y: -8, w: 100, h: 54 }, effect: "push" }
            },
            anim: {
                idle: { style: "body", color: "#da8", accent: "#fff" },
                walk: { style: "bodyStride", color: "#da8", accent: "#fff" },
                jump: { style: "bodyJump", color: "#da8", accent: "#fff" },
                attack: { style: "bodyPunch", color: "#da8", accent: "#f25" },
                kick: { style: "bodyKick", color: "#da8", accent: "#f25" },
                hurt: { style: "bodyHurt", color: "#da8", accent: "#f8a" },
                special: { style: "bodyBurst", color: "#da8", accent: "#ffd26a" }
            }
        }
    };

    // Controls mapping
    const humanControls = {
        p1: { left: "arrowleft", right: "arrowright", jump: "arrowup", punch: "k", kick: "l", special: ";" },
        p2: { left: "a", right: "d", jump: "w", punch: "f", kick: "g", special: "h" }
    };

    // Game state machine
    let gameState = 'title'; // 'title' | 'select' | 'fight' | 'matchWin'
    let selected = { p1: 'alex', p2: 'beth', stage: 'cafe' };

    // Players
    const players = [];

    class Actor {
        constructor(def, x, facing = 1, control = 'human') {
            this.def = def;
            this.x = x; this.y = FLOOR;
            this.vx = 0; this.vy = 0;
            this.facing = facing;
            this.state = 'idle';
            this.onGround = true;
            this.health = MAX_HEALTH;
            this.control = control;
            this.actionTimer = 0;
            this.currentMove = null;
            this.movePhase = null;
            this.hurtTimer = 0;
            this.wins = 0;
        }
        width() { return this.def.w * this.def.scale; }
        height() { return this.def.h * this.def.scale; }
        center() { return this.x + this.width() / 2; }

        update(opponent) {
            // gravity
            this.vy += G;
            this.y += this.vy;
            if (this.y >= FLOOR) { this.y = FLOOR; this.vy = 0; this.onGround = true; }
            else this.onGround = false;

            // control
            if (this.control === 'human') this._updateHuman();
            else this._updateAI(opponent);

            // move clamp
            this.x += this.vx;
            this.x = clamp(this.x, 20, WIDTH - 20 - this.width());

            // timers
            if (this.actionTimer > 0) this.actionTimer--;
            if (this.hurtTimer > 0) this.hurtTimer--;

            // face opponent
            if (opponent) { this.facing = (opponent.center() > this.center()) ? 1 : -1; }

            // effects
            if (this.currentMove && this.currentMove.effect === "rise" && this.state === "special_active") {
                this.vy = -8;
            }
            if (this.currentMove && this.currentMove.effect === "push" && this.state === "special_active") {
                // slight outward wave push visual only
            }
        }

        _updateHuman() {
            const mapping = (this === players[0]) ? humanControls.p1 : humanControls.p2;
            const busy = this.actionTimer > 0 || this.hurtTimer > 0;
            if (!busy) {
                if (keys[mapping.left]) { this.vx = -this.def.speed; this.state = 'walk'; }
                else if (keys[mapping.right]) { this.vx = this.def.speed; this.state = 'walk'; }
                else { this.vx = 0; if (this.onGround) this.state = 'idle'; }
                if (keys[mapping.jump] && this.onGround) { this.vy = this.def.jumpSpeed; this.onGround = false; this.state = 'jump'; }

                if (keys[mapping.punch]) this.tryMove('punch');
                if (keys[mapping.kick]) this.tryMove('kick');
                if (keys[mapping.special]) this.tryMove('special');
            } else {
                this.vx *= 0.6;
            }
        }
        _updateAI(opponent) {
            const dist = opponent.center() - this.center();
            if (Math.abs(dist) > 200) {
                this.vx = this.def.speed * Math.sign(dist);
                this.state = 'walk';
            } else {
                this.vx = 0;
                if (Math.random() < 0.02 && this.actionTimer <= 0) this.tryMove('punch');
                if (Math.random() < 0.01 && this.actionTimer <= 0) this.tryMove('special');
            }
        }
        tryMove(moveKey) {
            if (this.actionTimer > 0 || this.hurtTimer > 0) return false;
            const move = this.def.moves[moveKey];
            if (!move) return false;
            this.currentMove = move;
            this.actionTimer = move.startup + move.active + move.recovery;
            this.movePhase = { phase: 'startup', timer: move.startup };
            this.state = moveKey === 'special' ? 'special_start' : (moveKey === 'kick' ? 'kick_start' : 'attack_start');
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
                this.state = (this.currentMove === this.def.moves.special) ? 'special_active' : (this.state.includes('kick') ? 'kick_active' : 'attack_active');
                if (!this.movePhase.didHit) { this.movePhase.didHit = true; return this.currentMove; }
                return null;
            }
            return null;
        }
        receiveHit(move, attacker) {
            if (this.hurtTimer > 0) return;
            this.health = clamp(this.health - move.dmg, 0, MAX_HEALTH);
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
            const x = this.x;
            const y = this.y - h + 10;
            return { x: x, y: y, w: w, h: h };
        }

        draw(ctx) {
            const w = this.width(), h = this.height();
            const drawX = this.x;
            const drawY = this.y - h + 10;

            ctx.save();
            if (this.facing === -1) {
                ctx.translate(drawX + w / 2, 0);
                ctx.scale(-1, 1);
                ctx.translate(-drawX - w / 2, 0);
            }

            // Choose visual by state
            let key = 'idle';
            if (this.state.startsWith('attack')) key = 'attack';
            else if (this.state.startsWith('kick')) key = 'kick';
            else if (this.state.startsWith('special')) key = 'special';
            else if (this.state === 'walk') key = 'walk';
            else if (this.state === 'jump') key = 'jump';
            else if (this.state === 'hurt') key = 'hurt';

            const v = this.def.anim[key];

            // Placeholder sprite renderer: shapes vary per action
            ctx.translate(drawX, drawY);
            drawBodySprite(ctx, w, h, v);

            ctx.restore();

            // debug health (moved to topbars)
        }
    }

    // Placeholder sprite drawing functions (distinct looks per action)
    function drawBodySprite(ctx, w, h, v) {
        ctx.fillStyle = v.color;
        const t = performance.now() / 1000;

        switch (v.style) {
            case 'body':
                roundedRect(ctx, 0, 0, w, h, 8); ctx.fill();
                ctx.fillStyle = v.accent; ctx.fillRect(w * 0.2, h * 0.2, w * 0.6, h * 0.1);
                break;
            case 'bodyStride':
                roundedRect(ctx, 0, 0, w, h, 8); ctx.fill();
                ctx.fillStyle = v.accent;
                ctx.fillRect(w * 0.2 + Math.sin(t * 8) * 4, h * 0.75, w * 0.6, h * 0.08);
                break;
            case 'bodyJump':
                roundedRect(ctx, 0, 0, w, h, 8); ctx.fill();
                ctx.fillStyle = v.accent;
                ctx.fillRect(w * 0.25, h * 0.15, w * 0.5, h * 0.08);
                break;
            case 'bodyPunch':
                roundedRect(ctx, 0, 0, w, h, 8); ctx.fill();
                ctx.fillStyle = v.accent;
                ctx.fillRect(w * 0.6, h * 0.3, w * 0.35, h * 0.12);
                break;
            case 'bodyKick':
                roundedRect(ctx, 0, 0, w, h, 8); ctx.fill();
                ctx.fillStyle = v.accent;
                ctx.fillRect(w * 0.55, h * 0.8, w * 0.4, h * 0.08);
                break;
            case 'bodyUpper':
                roundedRect(ctx, 0, 0, w, h, 8); ctx.fill();
                glowCircle(ctx, w * 0.55, h * 0.2, Math.sin(t * 10) * 6 + 16, v.accent);
                break;
            case 'bodyBurst':
                roundedRect(ctx, 0, 0, w, h, 8); ctx.fill();
                glowRect(ctx, -20, h * 0.25, w + 40, h * 0.2, v.accent);
                break;
            case 'bodyHurt':
                ctx.globalAlpha = 0.7;
                roundedRect(ctx, 0, 0, w, h, 8); ctx.fill();
                ctx.globalAlpha = 1.0;
                ctx.strokeStyle = v.accent; ctx.lineWidth = 3; ctx.strokeRect(0, 0, w, h);
                break;
        }
    }
    function roundedRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }
    function glowCircle(ctx, x, y, r, color) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.shadowColor = color; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    function glowRect(ctx, x, y, w, h, color) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.shadowColor = color; ctx.shadowBlur = 12;
        ctx.fillRect(x, y, w, h);
        ctx.restore();
    }

    // Parallax render
    function renderStage(stage, cameraX) {
        const s = stages[stage];
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        s.layers.forEach((layer, i) => {
            const offset = (cameraX * layer.scroll) % WIDTH;
            ctx.fillStyle = layer.color;
            ctx.fillRect(-offset, layer.y, WIDTH, HEIGHT - layer.y);
            ctx.fillRect(-offset + WIDTH, layer.y, WIDTH, HEIGHT - layer.y);
        });

        ctx.fillStyle = s.floorColor;
        ctx.fillRect(0, FLOOR + 2, WIDTH, HEIGHT - FLOOR);
    }

    // Controls prompt text
    function drawCenteredText(txt, y, size = 24, color = "#fff") {
        ctx.fillStyle = color;
        ctx.font = `bold ${size}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(txt, WIDTH / 2, y);
        ctx.textAlign = "left";
    }

    // Title screen
    function showTitle() {
        panel.innerHTML = `
      <h1>Retro Punch</h1>
      <h2>How to play</h2>
      <ul>
        <li><b>P1:</b> Arrow Left/Right to move, Arrow Up to jump, K punch, L kick, ; special</li>
        <li><b>P2:</b> A/D move, W jump, F punch, G kick, H special</li>
      </ul>
      <p>Press Enter to continue.</p>
    `;
        overlay.style.display = 'flex';

        const onEnter = (e) => {
            if (e.key.toLowerCase() === 'enter') { window.removeEventListener('keydown', onEnter); overlay.style.display = 'none'; gameState = 'select'; showSelect(); }
        };
        window.addEventListener('keydown', onEnter);
    }

    // Character / arena select
    function showSelect() {
        overlay.style.display = 'flex';
        const charOptions = Object.keys(characters).map(k => `<div class="option" data-type="char" data-id="${k}">${characters[k].name}</div>`).join('');
        const stageOptions = Object.keys(stages).map(k => `<div class="option" data-type="stage" data-id="${k}">${stages[k].name}</div>`).join('');

        panel.innerHTML = `
      <h1>Select</h1>
      <h2>Player 1 character</h2>
      <div class="option-grid" id="p1-opts">${charOptions}</div>
      <h2>Player 2 character</h2>
      <div class="option-grid" id="p2-opts">${charOptions}</div>
      <h2>Arena</h2>
      <div class="option-grid" id="stage-opts">${stageOptions}</div>
      <p>Click options to choose. Press Enter to start.</p>
    `;

        function makeSelectable(containerId, targetKey) {
            const c = panel.querySelector(`#${containerId}`);
            c.querySelectorAll('.option').forEach(el => {
                if (el.dataset.id === selected[targetKey]) el.classList.add('selected');
                el.addEventListener('click', () => {
                    c.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
                    el.classList.add('selected');
                    selected[targetKey] = el.dataset.id;
                });
            });
        }
        makeSelectable('p1-opts', 'p1');
        makeSelectable('p2-opts', 'p2');
        makeSelectable('stage-opts', 'stage');

        const onEnter = (e) => {
            if (e.key.toLowerCase() === 'enter') {
                window.removeEventListener('keydown', onEnter);
                overlay.style.display = 'none';
                startFight();
            }
        };
        window.addEventListener('keydown', onEnter);
    }

    // Start fight setup
    let currentStage = 'cafe';

    function startFight() {
        gameState = 'fight';
        matchActive = true;

        currentStage = selected.stage;
        players.length = 0;

        const p1 = new Actor(characters[selected.p1], 140, 1, 'human');
        const p2 = new Actor(characters[selected.p2], WIDTH - 220, -1, 'human'); // make both human by default
        players.push(p1, p2);

        // Reset match counters here only
        players[0].wins = 0;
        players[1].wins = 0;

        p1NameEl.textContent = p1.def.name;
        p2NameEl.textContent = p2.def.name;
        p1BarEl.style.width = '100%';
        p2BarEl.style.width = '100%';
        p1RoundsEl.textContent = roundsDots(p1.wins);
        p2RoundsEl.textContent = roundsDots(p2.wins);
        round = 1;
        roundText.textContent = `Round ${round}`;

        startRound(); // initialize positions and timer
    }

    function startRound() {
        roundOver = false;

        // Reset positions and health
        players[0].x = 140; players[0].y = FLOOR; players[0].health = MAX_HEALTH;
        players[0].vx = 0; players[0].vy = 0; players[0].actionTimer = 0; players[0].currentMove = null; players[0].hurtTimer = 0; players[0].state = 'idle';

        players[1].x = WIDTH - 220; players[1].y = FLOOR; players[1].health = MAX_HEALTH;
        players[1].vx = 0; players[1].vy = 0; players[1].actionTimer = 0; players[1].currentMove = null; players[1].hurtTimer = 0; players[1].state = 'idle';

        // Timer
        let roundTimer = ROUND_TIMER;
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        timerInterval = setInterval(() => {
            if (gameState !== 'fight' || roundOver) return;
            roundTimer--;
            if (roundTimer <= 0) {
                clearInterval(timerInterval); timerInterval = null;
                // endRoundByTime();
                endRound();
            }
        }, 1000);
    }

    function endRound() {
        if (roundOver) return; // guard
        roundOver = true;

        // Check if player 1 health is greater than player 2
        if (players[0].health > players[1].health) {
            players[1].health = 0; // P1 wins by time
            const winner = players[0]
            return awardRound(winner);
        }

        // Check if player 2 health is greater than player 1
        if (players[1].health > players[0].health) {
            players[0].health = 0; // P2 wins by time
            const winner = players[1]
            return awardRound(winner);
        }

        // Tie! Both lose.
        if (players[1].health === players[0].health) {
            players[0].health = 0;
            players[1].health = 0;
            return awardRound()
        }
    }

    function awardRound(winner) {
        if (winner) winner.wins++;
        p1RoundsEl.textContent = roundsDots(players[0].wins);
        p2RoundsEl.textContent = roundsDots(players[1].wins);

        // Update health bars immediately
        p1BarEl.style.width = `${(players[0].health / MAX_HEALTH) * 100}%`;
        p2BarEl.style.width = `${(players[1].health / MAX_HEALTH) * 100}%`;

        // Match end?
        if (winner && winner.wins >= 3) {
            matchActive = false;
            gameState = 'matchWin';
            showWinAnimation(`${winner.def.name} wins the match!`);
            // Stop timer
            if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

            setTimeout(() => {
                // After match, go back to select (or call startFight() to auto-restart same match)
                gameState = 'select';
                showSelect();
            }, 2500);
            return;
        }

        // Continue to next round
        setTimeout(() => {
            round++;
            roundText.textContent = `Round ${round}`;
            startRound();
        }, 1000);
    }

    function resetRound() {
        players[0].x = 140;
        players[0].y = FLOOR;
        players[0].health = MAX_HEALTH;
        players[0].vx = 0;
        players[0].vy = 0;
        players[0].actionTimer = 0;
        players[0].currentMove = null;
        players[0].hurtTimer = 0;
        players[0].state = 'idle';

        players[1].x = WIDTH - 220;
        players[1].y = FLOOR;
        players[1].health = MAX_HEALTH;
        players[1].vx = 0;
        players[1].vy = 0;
        players[1].actionTimer = 0;
        players[1].currentMove = null;
        players[1].hurtTimer = 0;
        players[1].state = 'idle';

        // reset timer
        let roundTimer = ROUND_TIMER;
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (gameState !== 'fight') return;
            roundTimer--;
            if (roundTimer <= 0) {
                clearInterval(timerInterval);
                // time over: decide winner by health
                if (players[0].health = players[1].health) {
                    players[0].wins++
                    players[1].wins++
                } else {
                    const winner = players[0].health > players[1].health ? players[0] : players[1];
                    winner.wins++;
                }

                p1RoundsEl.textContent = roundsDots(players[0].wins);
                p2RoundsEl.textContent = roundsDots(players[1].wins);

                if (winner.wins >= 3) {
                    gameState = 'matchWin';
                    showWinAnimation(`${winner.def.name} wins the match!`);
                    setTimeout(() => { gameState = 'select'; showSelect(); }, 2500);
                } else {
                    setTimeout(resetRound, 1000);
                }
            }
        }, 1000); // tick every second
    }

    // Go back to menu
    window.addEventListener('keydown', e => {
        if (gameState === 'fight' && e.key.toLowerCase() === 'escape') {
            gameState = 'select';
            showSelect();
        }
    })

    // Win animation (big text + confetti)
    function showWinAnimation(text) {
        overlay.style.display = 'flex';
        panel.style.display = 'none';

        const winEl = document.createElement('div');
        winEl.className = 'win-text';
        winEl.textContent = text;
        overlay.appendChild(winEl);

        // confetti bursts
        for (let i = 0; i < 40; i++) {
            const c = document.createElement('div');
            c.className = 'confetti';
            c.style.left = `${(Math.random() * 60 + 20)}%`;
            c.style.top = `${(Math.random() * 20 + 35)}%`;
            c.style.background = i % 3 === 0 ? '#ffd26a' : (i % 3 === 1 ? '#4ad04a' : '#f46');
            c.style.transform = `translateY(-40px) rotate(${Math.random() * 180}deg)`;
            overlay.appendChild(c);
            setTimeout(() => overlay.removeChild(c), 1300);
        }
        setTimeout(() => {
            overlay.removeChild(winEl);
            overlay.style.display = 'none';
            panel.style.display = 'block';
        }, 2000);
    }

    // MAIN LOOP
    let last = performance.now();
    function loop(now = performance.now()) {
        const dt = now - last;
        last = now;

        // Update per state
        if (gameState === 'fight') {
            // Update actors
            players.forEach(p => p.update(players.find(q => q !== p)));

            // Check hits
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

            // Health bars
            p1BarEl.style.width = `${(players[0].health / MAX_HEALTH) * 100}%`;
            p2BarEl.style.width = `${(players[1].health / MAX_HEALTH) * 100}%`;

            // Round win check
            if (!roundOver && players.some(p => p.health <= 0)) {
                // endRoundByKO();
                endRound();
            }
        }

        // Render
        render();

        requestAnimationFrame(loop);
    }

    function render() {
        // camera (simple: midpoint of players)
        const camX = (players.length === 2) ? (players[0].center() + players[1].center()) / 2 : WIDTH / 2;

        renderStage(currentStage, camX);

        // Draw players in order for overlap
        if (players.length) {
            const sorted = players.slice().sort((a, b) => a.x - b.x);
            sorted.forEach(p => p.draw(ctx));
        }

        // Debug hitboxes (active)
        if (gameState === 'fight') {
            drawCenteredText(`${roundTimer}`, 40, 28, "#ffd26a");
            players.forEach(p => {
                const mv = p.currentMove && p.movePhase && p.movePhase.phase === 'active' ? p.currentMove : null;
                const hb = p.getHitboxForMove(mv);
                if (hb) {
                    ctx.strokeStyle = "rgba(255,0,0,0.9)"; ctx.lineWidth = 2;
                    ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
                }
            });
        }

        // Title watermark
        if (gameState === 'title') {
            drawCenteredText("Retro Punch", 140, 42, "#fff");
            drawCenteredText("Press Enter to continue", 190, 18, "#ffd26a");
        }
        if (gameState === 'select') {
            drawCenteredText("Select your fighters and arena", 140, 24, "#fff");
        }
    }

    // Initialize game
    async function init() {
        // Optional image loads (you can place files and switch to image rendering later)
        await Promise.all([
            loadImage('alex', 'assets/alex.png'),
            loadImage('beth', 'assets/beth.png')
        ]);
        showTitle();
        loop();
    }

    init();

    // Expose for editing
    window.RetroPunch = { players, characters, stages, setState: (s) => gameState = s, selected };
})();
