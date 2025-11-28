// Retro Punch - Enhanced

const langague = {
    pt: {
        titleScreen: {
            title: "Grupon Fighter",
            subtitle: "A capivara gritante",
            insertCoin: "Inserir ficha para começar",
            footer: "co.,ltd"
        }
    }
}

function game() {
    // --- CONFIGURATION ---
    const ROUNDS_TO_WIN = 3; // Best of 3
    const ROUND_DURATION = 10; // Seconds
    const MAX_HEALTH = 100;

    // --- LANGUAGE ---
    // TODO: add language selection
    let lang = "pt";
    const texts = langague[lang];

    // --- GLOBAL STATE ---
    const FLOOR_RATIO = 0.78;
    const GRAVITY = 0.6;
    let WIDTH = window.innerWidth;
    let HEIGHT = window.innerHeight;
    let FLOOR = Math.floor(HEIGHT * FLOOR_RATIO);

    // Timing & Slow Mo
    let last = performance.now();
    let timeScale = 1.0;
    let timeScaleTarget = 1.0;
    let slowMoTimer = 0;

    // Game Flow
    let gameState = 'splash'; // 'splash' | 'title' | 'select' | 'fight' | 'matchWin'
    let round = 1;
    let roundTimer = ROUND_DURATION;
    let roundOver = false;

    // Settings
    let selected = { p1: 'alex', p2: 'beth', stage: 'cafe' };
    let p2IsAI = true; // Default to AI

    // --- DOM ELEMENTS ---
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');

    const overlay = document.createElement('div'); // For Title/Select screens
    overlay.className = 'overlay';

    const panel = document.createElement('div');
    panel.className = 'panel';

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // --- ASSETS & DATA ---
    const images = {};
    function loadImage(key, src) {
        return new Promise((res, rej) => {
            const img = new Image();
            img.onload = () => { images[key] = img; res(img); };
            img.onerror = () => res(null);
            img.src = src;
        });
    }

    // Load specific stage assets
    async function loadStageAssets(stageKey) {
        const stage = stages[stageKey];
        if (!stage) return;

        const promises = stage.layers.map(async (layer) => {
            // If it's an array (Animation)
            if (Array.isArray(layer.src)) {
                layer.frames = await Promise.all(layer.src.map(s => loadImage('layerImage', s)));
            }
            // If it's a string (Static)
            else if (typeof layer.src === 'string' && layer.src.length > 0) {
                layer.imgElement = await loadImage('layerImage', layer.src);
            }
        });

        await Promise.all(promises);
    }

    // Parallax stage definitions
    // The further the layer, the closer it is to the players
    const stages = {
        cafe: {
            name: "Café",
            layers: [
                {
                    src: ["./assets/bg.jpg", "./assets/bg2.jpg"],
                    animSpeed: 0.5, // Seconds per frame
                    color: "#0a0f1a", y: 0, scroll: 0.1
                },
                { color: "#1a2033", y: 120, scroll: 0.2 },
                { color: "#24324a", y: 220, scroll: 0.4 },
                {
                    color: "#304a5a",
                    y: 320,
                    scroll: 0.7
                },
            ],
            floorColor: "#2a2318"
        },
        park: {
            name: "City Park",
            layers: [
                { img: "", color: "#081419", y: 0, scroll: 0.1 },
                { img: "", color: "#0f2a2f", y: 140, scroll: 0.25 },
                { img: "", color: "#135a3a", y: 220, scroll: 0.5 },
                { img: "", color: "#1f7a4a", y: 310, scroll: 0.8 },
            ],
            floorColor: "#3d2a1a"
        },
        campus: {
            name: "Campus",
            layers: [
                { img: "", color: "#0b1021", y: 0, scroll: 0.1 },
                { img: "", color: "#141a36", y: 110, scroll: 0.25 },
                { img: "", color: "#2b345e", y: 210, scroll: 0.5 },
                { img: "", color: "#454e8a", y: 300, scroll: 0.85 },
            ],
            floorColor: "#222222"
        }
    };

    // Character definitions with basic action sprites (placeholder shapes)
    // Each animation has a style to draw different looks for actions
    const characters = {
        alex: {
            name: "Alex", w: 48, h: 64, scale: 1.7, speed: 9, jumpSpeed: -16,
            moves: {
                punch: { name: "Punch", startup: 3, active: 4, recovery: 8, dx: 6, dmg: 8, hitbox: { x: 28, y: 14, w: 26, h: 16 } },
                kick: { name: "Kick", startup: 4, active: 4, recovery: 10, dx: 8, dmg: 12, hitbox: { x: 24, y: 36, w: 36, h: 14 } },
                special: { name: "Rising Strike", startup: 6, active: 6, recovery: 18, dx: 0, dmg: 18, hitbox: { x: 10, y: -30, w: 50, h: 60 }, effect: "rise" }
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
            name: "Beth", w: 46, h: 62, scale: 1.8, speed: 4.5, jumpSpeed: -14,
            moves: {
                punch: { name: "Rapid Jab", startup: 2, active: 3, recovery: 10, dx: 4, dmg: 6, hitbox: { x: 26, y: 12, w: 24, h: 14 } },
                kick: { name: "Sweep", startup: 5, active: 3, recovery: 12, dx: 10, dmg: 10, hitbox: { x: 22, y: 38, w: 32, h: 12 } },
                special: { name: "Energy Burst", startup: 12, active: 6, recovery: 22, dx: 0, dmg: 20, hitbox: { x: -20, y: -8, w: 100, h: 54 }, effect: "push" }
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

    // --- CONTROLS ---
    const keys = {};
    window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

    const humanControls = {
        p1: { left: "arrowleft", right: "arrowright", jump: "arrowup", punch: "k", kick: "l", special: ";" },
        p2: { left: "a", right: "d", jump: "w", punch: "f", kick: "g", special: "h" }
    };

    // --- DYNAMIC HUD SYSTEM ---
    let hud = null;

    function createHUD() {
        if (hud) return;
        hud = document.createElement('div');
        hud.id = 'game-hud';
        // Inline styles for simplicity, can be moved to CSS
        hud.style.cssText = `position:fixed; left:50%; top:10px; transform:translateX(-50%); width:min(1200px, 94%); z-index:100; pointer-events:none; font-family:monospace; color:white; display:flex; justify-content:space-between; align-items:flex-start; text-shadow:2px 2px 0 #000;`;

        hud.innerHTML = `
            <div style="width:40%">
                <div id="hud-p1-name" style="font-size:20px; font-weight:bold; margin-bottom:4px">P1</div>
                <div style="height:20px; background:rgba(0,0,0,0.5); border:2px solid #fff; border-radius:4px; overflow:hidden relative">
                    <div id="hud-p1-bar" style="height:100%; width:100%; background:#ffcc00; transition:width 0.1s"></div>
                </div>
                <div id="hud-p1-wins" style="margin-top:4px; font-size:16px; color:#aaa">● ○</div>
            </div>
            
            <div style="text-align:center; padding:0 20px">
                <div style="font-size:24px; font-weight:bold; color:#f00; background:#000; padding:2px 10px; border-radius:4px; border:1px solid #444" id="hud-timer">99</div>
            </div>

            <div style="width:40%; text-align:right">
                <div id="hud-p2-name" style="font-size:20px; font-weight:bold; margin-bottom:4px">P2</div>
                <div style="height:20px; background:rgba(0,0,0,0.5); border:2px solid #fff; border-radius:4px; overflow:hidden relative">
                    <div id="hud-p2-bar" style="height:100%; width:100%; background:#ffcc00; float:right; transition:width 0.1s"></div>
                </div>
                <div id="hud-p2-wins" style="margin-top:4px; font-size:16px; color:#aaa">● ○</div>
            </div>
        `;
        document.body.appendChild(hud);

        // Cache references
        hud.els = {
            p1Name: document.getElementById('hud-p1-name'),
            p1Bar: document.getElementById('hud-p1-bar'),
            p1Wins: document.getElementById('hud-p1-wins'),
            p2Name: document.getElementById('hud-p2-name'),
            p2Bar: document.getElementById('hud-p2-bar'),
            p2Wins: document.getElementById('hud-p2-wins'),
            timer: document.getElementById('hud-timer')
        };
    }

    function destroyHUD() {
        if (hud) {
            document.body.removeChild(hud);
            hud = null;
        }
    }

    function updateHUD() {
        if (!hud || !players.length) return;

        // Timer
        hud.els.timer.innerText = Math.ceil(roundTimer);
        if (roundTimer <= 10) hud.els.timer.style.color = '#f00';
        else hud.els.timer.style.color = '#fff';

        // Health
        const p1Pct = Math.max(0, (players[0].health / MAX_HEALTH) * 100);
        const p2Pct = Math.max(0, (players[1].health / MAX_HEALTH) * 100);

        hud.els.p1Bar.style.width = `${p1Pct}%`;
        hud.els.p2Bar.style.width = `${p2Pct}%`;

        // Color change on low health
        hud.els.p1Bar.style.background = p1Pct < 30 ? '#f44' : '#ffcc00';
        hud.els.p2Bar.style.background = p2Pct < 30 ? '#f44' : '#ffcc00';
    }

    function updateHUDWins() {
        if (!hud) return;
        const drawDots = (wins) => Array.from({ length: ROUNDS_TO_WIN }).map((_, i) => i < wins ? '●' : '○').join(' ');
        hud.els.p1Wins.innerText = drawDots(players[0].wins);
        hud.els.p2Wins.innerText = drawDots(players[1].wins);
    }

    // --- CANVAS SPLASH (OVERLAYS) ---
    let canvasSplash = null; // { type: 'KO'|'ROUND', text, sub, timer, scale, alpha }

    function triggerSplash(type, text, subText) {
        canvasSplash = {
            type: type,
            text: text,
            sub: subText,
            timer: 1.5, // seconds to live
            scale: 0.5,
            alpha: 1.0,
            confetti: []
        };

        // Generate confetti for big events
        if (type === 'KO' || type === 'WIN') {
            for (let i = 0; i < 50; i++) {
                canvasSplash.confetti.push({
                    x: WIDTH / 2, y: HEIGHT / 2,
                    vx: (Math.random() - 0.5) * 20,
                    vy: (Math.random() - 1.0) * 20,
                    color: `hsl(${Math.random() * 360}, 100%, 50%)`,
                    life: 2.0
                });
            }
        }
    }

    // --- GAME CLASSES ---
    const players = [];

    class Actor {
        constructor(def, x, facing = 1, control = 'human') {
            this.def = def;
            this.x = x;
            this.y = FLOOR;
            this.vx = 0;
            this.vy = 0;
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

        reset() {
            this.health = MAX_HEALTH;
            this.state = 'idle';
            this.vx = 0;
            this.vy = 0;
            this.onGround = true;
            this.actionTimer = 0;
            this.hurtTimer = 0;
            this.currentMove = null;
            this.movePhase = null;
            // Note: wins are NOT reset here, only on match start
        }

        update(dt, opponent) {
            // Physics / Gravity
            const seconds = dt; // dt is already in seconds-factor from main loop

            this.vy += GRAVITY * (seconds * 60); // approximate frame scaling
            this.y += this.vy * (seconds * 60);

            if (this.y >= FLOOR) {
                this.y = FLOOR;
                this.vy = 0;
                this.onGround = true;
            } else {
                this.onGround = false;
            }

            // Input / AI
            if (this.control === 'human') this._updateHuman();
            else if (opponent) this._updateAI(opponent);

            // Movement
            this.x += this.vx * (seconds * 60);
            this.x = Math.max(20, Math.min(WIDTH - 20 - this.width(), this.x));

            // Timers (using raw frames approx for simplicity in logic)
            if (this.actionTimer > 0) this.actionTimer -= (seconds * 60);
            if (this.hurtTimer > 0) this.hurtTimer -= (seconds * 60);

            // Orientation of fighter
            if (opponent && this.state !== 'hurt' && this.actionTimer <= 0) {
                this.facing = (opponent.center() > this.center()) ? 1 : -1;
            }
        }

        _updateHuman() {
            if (this.actionTimer > 0 || this.hurtTimer > 0) return;

            const map = (this === players[0])
                ? humanControls.p1
                : humanControls.p2;

            if (keys[map.left]) {
                this.vx = -this.def.speed;
                this.state = 'walk';
            }
            else if (keys[map.right]) {
                this.vx = this.def.speed;
                this.state = 'walk';
            }
            else {
                this.vx = 0;
                if (this.onGround) this.state = 'idle';
            }

            if (keys[map.jump] && this.onGround) {
                this.vy = this.def.jumpSpeed;
                this.onGround = false;
                this.state = 'jump';
            }

            if (keys[map.punch]) this.tryMove('punch');
            if (keys[map.kick]) this.tryMove('kick');
            if (keys[map.special]) this.tryMove('special');
        }

        _updateAI(opponent) {
            if (this.actionTimer > 0 || this.hurtTimer > 0) return;

            const dist = Math.abs(opponent.center() - this.center());
            const dir = Math.sign(opponent.center() - this.center());

            // Simple AI Logic from game.new3.js
            if (dist > 90) {
                // Too far, approach
                // TODO: add logic to also maybe 'jump' to close distance
                this.vx = this.def.speed * dir;
                this.state = 'walk';
            } else if (dist < 60 && Math.random() < 0.05) {
                // Too close, maybe retreat
                // TODO: add logic to also maybe 'jump' to retreat
                this.vx = -this.def.speed * dir;
                this.state = 'walk';
            } else {
                // Fighting range
                this.vx = 0;
                this.state = 'idle';

                // Random attacks based on distance
                const rand = Math.random();
                if (dist < 80 && rand < 0.05) this.tryMove('punch');
                else if (dist < 140 && rand < 0.03) this.tryMove('kick');
                else if (rand < 0.01) this.tryMove('special');
            }
        }

        tryMove(key) {
            const move = this.def.moves[key];
            this.currentMove = move;
            this.actionTimer = move.startup + move.active + move.recovery;
            this.movePhase = {
                phase: 'startup',
                timer: move.startup,
                didHit: false
            };

            // Set distinct state for drawing logic
            if (key === 'kick') this.state = 'kick_start';
            else if (key === 'special') this.state = 'special_start';
            else this.state = 'attack_start';
        }

        checkMoveFrames() {
            if (!this.currentMove || this.hurtTimer > 0) return null;

            const total = this.currentMove.startup + this.currentMove.active + this.currentMove.recovery;
            const elapsed = total - this.actionTimer;

            if (elapsed >= this.currentMove.startup && elapsed < (this.currentMove.startup + this.currentMove.active)) {
                // Keep the "type" of state (attack vs kick) but mark active
                if (this.state.includes('kick')) this.state = 'kick_active';
                else if (this.state.includes('special')) this.state = 'special_active';
                else this.state = 'attack_active';

                if (!this.movePhase.didHit) {
                    this.movePhase.didHit = true;
                    return this.currentMove;
                }
            } else if (elapsed >= (this.currentMove.startup + this.currentMove.active)) {
                this.state = 'recovery';
            }
            return null;
        }

        receiveHit(move, attacker) {
            if (this.hurtTimer > 0) return; // Invincible while hurt

            this.health = Math.max(0, this.health - move.dmg);
            this.hurtTimer = 25; // frames of stun
            this.state = 'hurt';
            this.vx = 8 * (this.x < attacker.x ? -1 : 1);
            this.vy = -5;

            // Camera shake or hit effect could go here
            // TODO: Fix effects during special moves according to new logic
            // Currently are 2 effects listed on special moves but not implemented: 'push' and 'rise'
        }

        getHitbox() {
            if (!this.currentMove) return null;
            const hb = this.currentMove.hitbox;
            const wx = this.facing === 1
                ? this.x + this.width() / 2 + hb.x
                : this.x + this.width() / 2 - (hb.x + hb.w);

            return {
                x: wx,
                y: this.y - this.height() + 10 + hb.y,
                w: hb.w,
                h: hb.h
            };
        }

        getHurtbox() {
            return {
                x: this.x,
                y: this.y - this.height() + 10,
                w: this.width(),
                h: this.height()
            };
        }

        draw(ctx) {
            const w = this.width(), h = this.height();
            const drawX = this.x, drawY = this.y - h + 10;

            ctx.save();
            // Flip if facing left
            if (this.facing === -1) {
                ctx.translate(drawX + w / 2, 0);
                ctx.scale(-1, 1);
                ctx.translate(-drawX - w / 2, 0);
            }

            // --- ANIMATION STATE SELECTOR ---
            let animKey = 'idle';
            if (this.state === 'hurt') animKey = 'hurt';
            else if (this.state.includes('special')) animKey = 'special';
            else if (this.state.includes('kick')) animKey = 'kick';
            else if (this.state.includes('attack')) animKey = 'attack';
            else if (this.state === 'jump') animKey = 'jump';
            else if (this.state === 'walk') animKey = 'walk';
            else animKey = 'idle';

            const animDef = this.def.anim[animKey];

            // Render Sprite
            ctx.translate(drawX, drawY);
            drawBodySprite(ctx, w, h, animDef);

            ctx.restore();
        }
    }

    // --- SPRITE RENDERING FUNCTIONS ---
    function drawBodySprite(ctx, w, h, v) {
        ctx.fillStyle = v.color;
        const t = performance.now() / 1000;

        switch (v.style) {
            case 'body':
                roundedRect(ctx, 0, 0, w, h, 8); ctx.fill();
                ctx.fillStyle = v.accent;
                ctx.fillRect(w * 0.2, h * 0.2, w * 0.6, h * 0.1);
                break;
            case 'bodyStride':
                roundedRect(ctx, 0, 0, w, h, 8); ctx.fill();
                ctx.fillStyle = v.accent;
                // Bobbing visor
                ctx.fillRect(w * 0.2 + Math.sin(t * 15) * 2, h * 0.25, w * 0.6, h * 0.1);
                break;
            case 'bodyJump':
                roundedRect(ctx, 0, 0, w, h, 8); ctx.fill();
                ctx.fillStyle = v.accent;
                ctx.fillRect(w * 0.25, h * 0.15, w * 0.5, h * 0.08);
                // Leg tucked visual
                ctx.fillStyle = "rgba(0,0,0,0.2)";
                ctx.fillRect(w * 0.2, h * 0.8, w * 0.6, h * 0.15);
                break;
            case 'bodyPunch':
                roundedRect(ctx, 0, 0, w, h, 8); ctx.fill();
                ctx.fillStyle = v.accent;
                // Fist extended
                ctx.fillRect(w * 0.6, h * 0.3, w * 0.5, h * 0.15);
                break;
            case 'bodyKick':
                roundedRect(ctx, 0, 0, w, h, 8); ctx.fill();
                ctx.fillStyle = v.accent;
                // Leg extended
                ctx.fillRect(w * 0.5, h * 0.75, w * 0.6, h * 0.15);
                break;
            case 'bodyUpper':
                roundedRect(ctx, 0, 0, w, h, 8); ctx.fill();
                glowCircle(ctx, w * 0.5, h * 0.2, Math.sin(t * 10) * 8 + 20, v.accent);
                break;
            case 'bodyBurst':
                roundedRect(ctx, 0, 0, w, h, 8); ctx.fill();
                glowRect(ctx, -10, h * 0.25, w + 20, h * 0.2, v.accent);
                break;
            case 'bodyHurt':
                ctx.globalAlpha = 0.7;
                roundedRect(ctx, 0, 0, w, h, 8); ctx.fill();
                ctx.globalAlpha = 1.0;
                ctx.strokeStyle = v.accent;
                ctx.lineWidth = 3;
                ctx.strokeRect(0, 0, w, h);
                break;
            default:
                // Fallback
                roundedRect(ctx, 0, 0, w, h, 8); ctx.fill();
                break;
        }
    }

    function roundedRect(ctx, x, y, w, h, r) {
        ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    function glowCircle(ctx, x, y, r, color) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function glowRect(ctx, x, y, w, h, color) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.fillRect(x, y, w, h);
        ctx.restore();
    }

    // --- GAME LOOP & LOGIC ---
    function startFight() {
        gameState = 'fight';

        // Setup Players
        players.length = 0;
        players.push(new Actor(characters[selected.p1], 150, 1, 'human'));
        // P2 is Human or AI based on toggle
        players.push(new Actor(characters[selected.p2], WIDTH - 200, -1, p2IsAI ? 'ai' : 'human'));

        // Reset Match Wins
        players[0].wins = 0;
        players[1].wins = 0;

        round = 1;
        createHUD();
        updateHUDWins();
        startRound();
    }

    function startRound() {
        roundOver = false;
        roundTimer = ROUND_DURATION;
        timeScaleTarget = 1.0;
        timeScale = 1.0;

        // Reset positions
        players[0].reset();
        players[0].x = 150;
        players[0].y = FLOOR;
        players[0].facing = 1;

        players[1].reset();
        players[1].x = WIDTH - 200;
        players[1].y = FLOOR;
        players[1].facing = -1;

        triggerSplash('ROUND', `Round ${round}`, 'FIGHT!');
        updateHUD();
    }

    function endRound(winner) {
        if (roundOver) return;
        roundOver = true;

        if (winner) {
            winner.wins++;
            updateHUDWins();
            // Slow motion effect
            timeScaleTarget = 0.1;
            slowMoTimer = 2.0; // Real seconds of slow mo
            triggerSplash('KO', 'K.O.', winner.def.name + " Wins");
        } else {
            // Time over / Tie
            triggerSplash('KO', 'TIME OVER', 'Draw Game');
        }

        setTimeout(() => {
            if (winner && winner.wins >= ROUNDS_TO_WIN) {
                endMatch(winner);
            } else {
                round++;
                startRound();
            }
        }, 3000);
    }

    function endMatch(winner) {
        gameState = 'matchWin';
        destroyHUD();
        triggerSplash('WIN', 'WINNER!', winner.def.name);
        setTimeout(() => {
            showSelect();
        }, 4000);
    }

    function loop(now = performance.now()) {
        const rawDt = (now - last) / 1000; // Raw delta in seconds
        last = now;

        // Smooth time scaling
        if (Math.abs(timeScale - timeScaleTarget) > 0.01) {
            timeScale += (timeScaleTarget - timeScale) * 0.1;
        }

        // Count down slow mo timer
        if (slowMoTimer > 0) {
            slowMoTimer -= rawDt;
            if (slowMoTimer <= 0) timeScaleTarget = 1.0; // Restore speed
        }

        const dt = rawDt * timeScale;

        update(dt);
        render();
        requestAnimationFrame(loop);
    }

    function update(dt) {
        if (gameState !== 'fight') return;

        // Update Splash
        if (canvasSplash) {
            canvasSplash.timer -= (dt / timeScale); // * 0.016; // tick independent of game speed? No, visuals should run.
            // Actually, let splash run on real time so it's snappy even in slow mo
            if (canvasSplash.timer <= 0) canvasSplash = null;
            else {
                canvasSplash.scale += (1 - canvasSplash.scale) * 0.05;
                canvasSplash.confetti.forEach(c => {
                    c.x += c.vx; c.y += c.vy; c.vy += 0.5; c.life -= 0.01;
                });
            }
        }

        if (roundOver) {
            // Only update physics during slow mo KO, no logic
            players.forEach(p => p.update(dt, null));
            return;
        }

        // Timer
        roundTimer -= dt;
        if (roundTimer <= 0) {
            const p1h = players[0].health;
            const p2h = players[1].health;
            endRound(p1h > p2h ? players[0] : (p2h > p1h ? players[1] : null));
            return;
        }

        // Players
        players.forEach(p => p.update(dt, players.find(o => o !== p)));

        // Collision
        const p1 = players[0], p2 = players[1];

        // Simple Hit Check
        [p1, p2].forEach(attacker => {
            const defender = attacker === p1 ? p2 : p1;
            const move = attacker.checkMoveFrames();
            if (move) {
                const hb = attacker.getHitbox();
                const hurt = defender.getHurtbox();
                if (hb && rectsIntersect(hb, hurt)) {
                    defender.receiveHit(move, attacker);
                    // SFX could go here
                    // TODO: if attacker is 'under' the opponent z-axis, move it to the first plane so animations are visible
                    if (defender.health <= 0) {
                        endRound(attacker);
                    }
                }
            }
        });

        updateHUD();
    }

    function render() {
        // Clear
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        // Camera
        let camX = WIDTH / 2;
        if (players.length === 2) {
            camX = (players[0].center() + players[1].center()) / 2;
        }

        // Stage
        const stage = stages[selected.stage] || stages.cafe;
        loadStageAssets(selected.stage);
        stage.layers.forEach(l => {
            const off = (camX * l.scroll) % WIDTH;
            // Draw Color Background (Fallback or Tint)
            ctx.fillStyle = l.color;
            // We fill the whole width twice to handle the scroll wrap
            ctx.fillRect(-off, l.y, WIDTH, HEIGHT);
            ctx.fillRect(-off + WIDTH, l.y, WIDTH, HEIGHT);

            // Determine Image to Draw
            let imgToDraw = null;

            if (l.frames && l.frames.length > 0) {
                // Handle Animation
                const speed = l.animSpeed || 0.2;
                // Use global time to determine frame index
                const frameIndex = Math.floor(last / 1000 / speed) % l.frames.length;
                imgToDraw = l.frames[frameIndex];
            } else if (l.imgElement) {
                // Handle Static
                imgToDraw = l.imgElement;
            }

            // Draw Image (Parallax Repeat)
            if (imgToDraw) {
                // Draw first copy
                // Assumes image is designed to fill WIDTH. 
                // If your images are smaller/tiled, you might need a loop here.
                ctx.drawImage(imgToDraw, -off, l.y, WIDTH, imgToDraw.height * (WIDTH / imgToDraw.width));

                // Draw second copy for wrapping
                ctx.drawImage(imgToDraw, -off + WIDTH, l.y, WIDTH, imgToDraw.height * (WIDTH / imgToDraw.width));
            }
        });

        // Floor
        ctx.fillStyle = stage.floorColor;
        ctx.fillRect(0, FLOOR, WIDTH, HEIGHT - FLOOR);

        // Players
        // Sort by Y so lower player is in front
        const sorted = [...players].sort((a, b) => a.y - b.y);
        sorted.forEach(p => p.draw(ctx));

        // Canvas Splash (Overlays)
        if (canvasSplash) {
            ctx.save();
            ctx.shadowColor = "#000";
            ctx.shadowBlur = 10;

            // Confetti
            canvasSplash.confetti.forEach(c => {
                ctx.fillStyle = c.color;
                ctx.fillRect(c.x, c.y, 8, 8);
            });

            // Text
            const size = 100 * canvasSplash.scale;
            ctx.font = `900 ${size}px Arial`;
            ctx.fillStyle = "#ffcc00";
            ctx.textAlign = "center";
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 4;

            ctx.fillText(canvasSplash.text, WIDTH / 2, HEIGHT / 2);
            ctx.strokeText(canvasSplash.text, WIDTH / 2, HEIGHT / 2);

            ctx.font = `bold ${size * 0.4}px Arial`;
            ctx.fillStyle = "#fff";
            ctx.fillText(canvasSplash.sub, WIDTH / 2, HEIGHT / 2 + size * 0.6);

            ctx.restore();
        }
    }

    // --- UI HELPERS ---
    let titleHandler = null;
    let selectHandler = null;

    function showTitle() {
        destroyHUD();
        gameState = 'title';
        panel.innerHTML = `
        <div class="wrapper">
            <img src="assets/logo.png" class="logo"/>
            <h1 class="hidden">${texts.titleScreen.title}</h1>
            <h2 class="title tiny5">${texts.titleScreen.subtitle}</h2>
            <p class="insertCoin tiny5 blink">${texts.titleScreen.insertCoin}</p>
            <p class="footer tiny5"><a href="https://fogol.in/?referral=grupon-fighter" target="_blank">@fogol.in</a> ${texts.titleScreen.footer}.</p>
        </div>
        `;

        titleHandler = (e) => {
            if (e.key === 'Enter') {
                window.removeEventListener('keydown', titleHandler);
                showSelect();
            }
        };
        window.addEventListener('keydown', titleHandler);
    }

    function showSelect() {
        gameState = 'select';
        overlay.style.display = 'flex';

        const makeOpts = (obj, type) => Object.keys(obj).map(k =>
            `<div class="option ${selected[type] === k ? 'selected' : ''}" data-k="${k}" onclick="window.selectOpt('${type}', '${k}')">${obj[k].name}</div>`
        ).join('');

        panel.innerHTML = `
            <h2>SELECT FIGHTER</h2>
            <div style="display:flex; gap:20px; justify-content:center; margin-bottom:20px">
                <div>
                    <h3>P1</h3>
                    <div id="p1-opts" class="opt-grid">${makeOpts(characters, 'p1')}</div>
                </div>
                <div>
                    <h3>P2 <button id="ai-toggle" style="background:${p2IsAI ? '#f00' : '#444'}; color:#fff; border:none; padding:4px 8px; cursor:pointer" onclick="window.toggleAI()">CPU: ${p2IsAI ? 'ON' : 'OFF'}</button></h3>
                    <div id="p2-opts" class="opt-grid">${makeOpts(characters, 'p2')}</div>
                </div>
            </div>
            <h3>SELECT STAGE</h3>
            <div id="stage-opts" class="opt-grid" style="display:flex; justify-content:center; gap:10px">${makeOpts(stages, 'stage')}</div>
            <p style="margin-top:20px">PRESS ENTER TO FIGHT</p>
            <style>
                .opt-grid .option { padding: 10px; background: #333; margin: 4px; cursor: pointer; border: 2px solid #555; }
                .opt-grid .option.selected { background: #f00; border-color: #fff; }
            </style>
        `;

        // Global handlers for HTML string clicks
        window.selectOpt = (type, k) => {
            selected[type] = k;
            showSelect(); // Re-render to update classes
        };

        window.toggleAI = () => {
            p2IsAI = !p2IsAI;
            showSelect();
        };

        titleHandler = (e) => {
            if (e.key === 'Enter') {
                window.removeEventListener('keydown', titleHandler);
                overlay.style.display = 'none';
                startFight();
            }
        };
        window.addEventListener('keydown', titleHandler);
    }

    // --- UTILS ---
    function roundedRect(ctx, x, y, w, h, r) {
        ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    function rectsIntersect(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    // Check if there is a window resizing and adjust canvas
    function resizeCanvas() {
        WIDTH = window.innerWidth;
        HEIGHT = window.innerHeight;
        FLOOR = Math.floor(HEIGHT * FLOOR_RATIO);

        canvas.width = WIDTH;
        canvas.height = HEIGHT;

        // keep CSS sized to full viewport
        canvas.style.width = WIDTH + 'px';
        canvas.style.height = HEIGHT + 'px';
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Initialize game
    async function init() {
        showTitle();
        loop();
    }

    init();
}

// Start the game
game();