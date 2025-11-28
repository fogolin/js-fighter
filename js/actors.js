// Actor class: movement, moves, hitboxes
import { spawnProjectile } from './projectiles.js';
import { getCharacterDef } from './characters.js';

export class Actor {
    constructor(id, x, facing = 1, control = 'human') {
        this.def = getCharacterDef(id);
        this.x = x; this.y = 0; this.vx = 0; this.vy = 0;
        this.facing = facing; this.control = control;
        this.health = 100; this.actionTimer = 0; this.currentMove = null; this.movePhase = null;
        this.blocking = false; this.specialCooldown = 0;
    }
    width() { return this.def.w * this.def.scale; }
    height() { return this.def.h * this.def.scale; }
    center() { return this.x + this.width() / 2; }
    getHurtbox() { return { x: this.x, y: this.y - this.height(), w: this.width(), h: this.height() }; }
    tryMove(key) {
        const m = this.def.moves[key]; if (!m) return false;
        if (m.effect === 'projectile' && this.specialCooldown > 0) return false;
        this.currentMove = m; this.actionTimer = (m.startup + m.active + m.recovery) * 16;
        this.movePhase = { phase: 'startup', timer: m.startup * 16, didHit: false, didSpawn: false };
        if (m.effect === 'projectile') this.specialCooldown = m.cooldown || 4000;
        return true;
    }
    checkMoveFrames() {
        if (!this.currentMove) return null;
        const m = this.currentMove;
        const total = (m.startup + m.active + m.recovery) * 16;
        const elapsed = total - Math.max(0, this.actionTimer);
        if (elapsed < m.startup * 16) return null;
        const a = elapsed - m.startup * 16;
        if (a < m.active * 16) {
            if (!this.movePhase.didHit) { this.movePhase.didHit = true; return m; }
        }
        return null;
    }
    receiveHit(dmg) { this.health = Math.max(0, this.health - dmg); }
    spawnSpecialProjectile(projDef) {
        const dir = this.facing;
        spawnProjectile({ x: this.center() + dir * 24, y: this.y - this.height() / 2, w: projDef.w, h: projDef.h, vx: projDef.speed * dir, vy: 0, ttl: 3000, dmg: projDef.dmg, owner: this });
    }
}
