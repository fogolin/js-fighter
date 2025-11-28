// Core game loop, rendering and orchestration
import { Actor } from './actors.js';
import { runAI } from './ai.js';
import { getCharacterDef } from './characters.js';
import { updateProjectiles, drawProjectiles, spawnProjectile } from './projectiles.js';
import { createHUD, destroyHUD, renderHUDUpdate } from './hud.js';
import { getKeys } from './input.js';

let canvasEl, ctx;
let WIDTH = 800, HEIGHT = 600, FLOOR = 480;
let last = performance.now();
let running = false;
let players = [];
let round = 1, roundTimer = 90, roundOver = false;
let currentStage = 'cafe';
let timeScale = 1, timeScaleTarget = 1, slowMoTimer = 0;

export function setCanvas(c) { canvasEl = c; ctx = c.getContext('2d'); resize(); window.addEventListener('resize', resize); }
function resize() { if (!canvasEl) return; WIDTH = window.innerWidth; HEIGHT = window.innerHeight; FLOOR = Math.floor(HEIGHT * 0.78); canvasEl.width = WIDTH; canvasEl.height = HEIGHT; }

export function setAIFlag(flag) { /* no-op here, menu sets p2IsAI via startGameLoop options */ }

export function startGameLoop({ p1 = 'alex', p2 = 'beth', stage = 'cafe', p2IsAI = false } = {}) {
    // init players
    players = [];
    players.push(new Actor(p1, 140, 1, 'human'));
    players.push(new Actor(p2, WIDTH - 220, -1, p2IsAI ? 'ai' : 'human'));
    players.forEach(p => { p.y = FLOOR; p.health = 100; p.vx = 0; p.vy = 0; p.specialCooldown = 0; });
    round = 1; roundTimer = 90; roundOver = false; currentStage = stage;
    createHUD();
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
}

export function stopGameLoop() { running = false; destroyHUD(); players = []; }

function loop(now) {
    if (!running) return;
    const rawDt = now - last; last = now;
    // smooth timeScale
    if (Math.abs(timeScale - timeScaleTarget) > 0.001) timeScale += (timeScaleTarget - timeScale) * 0.18;
    const dt = rawDt * timeScale;
    update(dt, rawDt);
    render();
    requestAnimationFrame(loop);
}

function update(dt, rawDt) {
    const keys = getKeys();
    // update actors
    for (let i = 0; i < players.length; i++) {
        const p = players[i];
        const opp = players[1 - i];
        // reduce timers
        if (p.actionTimer > 0) p.actionTimer = Math.max(0, p.actionTimer - dt);
        if (p.specialCooldown > 0) p.specialCooldown = Math.max(0, p.specialCooldown - rawDt);

        // AI
        if (p.control === 'ai') runAI(p, opp, dt, keys);

        // apply velocities
        p.x += p.vx * (dt / 16.6667);
        // clamp
        p.x = Math.max(20, Math.min(WIDTH - 20 - p.width(), p.x));
        p.y = FLOOR;

        // move resolution
        const move = p.checkMoveFrames();
        if (move) {
            // special spawn
            if (move.effect === 'projectile' && p.movePhase && !p.movePhase.didSpawn) {
                p.movePhase.didSpawn = true;
                p.spawnSpecialProjectile(move.proj);
            }
            // hit opponent
            const hb = getHitboxForActorMove(p, move);
            const db = opp.getHurtbox();
            if (hb && rectsIntersect(hb, db)) {
                const dmg = move.dmg;
                opp.receiveHit(dmg);
            }
        }
    }

    // projectiles
    updateProjectiles(rawDt, players, rectsIntersect, (pl, proj) => {
        if (pl.blocking) pl.receiveHit(Math.floor(proj.dmg * 0.25));
        else pl.receiveHit(proj.dmg);
    });

    // round timer wall clock
    roundTimer -= rawDt / 1000;
    if (roundTimer <= 0 && !roundOver) { roundOver = true; handleTimeUp(); }

    // HUD update
    renderHUDUpdate({
        p1Name: players[0].def.name, p2Name: players[1].def.name,
        p1HP: players[0].health, p2HP: players[1].health,
        round, timer: roundTimer, p2IsAI: players[1].control === 'ai'
    });

    // KO check
    if (!roundOver && players.some(p => p.health <= 0)) {
        roundOver = true;
        const winner = players[0].health > players[1].health ? players[0] : players[1];
        // slowmo and award
        timeScaleTarget = 0.12; slowMoTimer = 600;
        setTimeout(() => { timeScaleTarget = 1; awardRound(winner); }, 800);
    }

    // slow mo wall timer
    if (slowMoTimer > 0) slowMoTimer = Math.max(0, slowMoTimer - rawDt);

}

function awardRound(winner) {
    winner.wins = (winner.wins || 0) + 1;
    if (winner.wins >= 3) { // match end
        stopGameLoop();
        // show match win as simple alert (or you can create a canvas splash)
        setTimeout(() => alert(`${winner.def.name} wins the match!`), 200);
        return;
    }
    // next round
    round++; roundOver = false; roundTimer = 90;
    players.forEach(p => { p.health = 100; p.actionTimer = 0; p.vx = 0; p.specialCooldown = 0; });
}

function handleTimeUp() {
    // award round to whoever has more health
    const winner = players[0].health >= players[1].health ? players[0] : players[1];
    awardRound(winner);
}

function getHitboxForActorMove(actor, move) {
    if (!move) return null;
    const hb = move.hitbox;
    const w = actor.width(), h = actor.height();
    const ox = actor.facing === 1 ? hb.x : -(hb.x + hb.w);
    const x = actor.x + (w / 2) + ox;
    const y = actor.y - h + 10 + hb.y;
    return { x, y, w: hb.w, h: hb.h };
}

function rectsIntersect(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

function render() {
    // clear
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // simple background
    ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // floor
    ctx.fillStyle = '#222'; ctx.fillRect(0, FLOOR, WIDTH, HEIGHT - FLOOR);
    // draw projectiles
    drawProjectiles(ctx);
    // draw players
    players.slice().sort((a, b) => a.x - b.x).forEach(p => drawActor(p, ctx));
}

function drawActor(p, ctx) {
    const w = p.width(), h = p.height();
    const drawX = p.x, drawY = p.y - h + 10;
    ctx.save();
    if (p.facing === -1) { ctx.translate(drawX + w / 2, 0); ctx.scale(-1, 1); ctx.translate(-drawX - w / 2, 0); }
    ctx.fillStyle = (p === players[0]) ? '#6ad' : '#da8';
    roundRect(ctx, drawX, drawY, w, h, 8); ctx.fill();
    // name
    ctx.fillStyle = '#fff'; ctx.font = '14px monospace'; ctx.fillText(p.def.name, drawX, drawY - 8);
    ctx.restore();
    // health bar
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(drawX, drawY - 18, 60, 6);
    ctx.fillStyle = 'lime'; ctx.fillRect(drawX, drawY - 18, 60 * (p.health / 100), 6);
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
