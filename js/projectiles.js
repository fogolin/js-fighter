// simple projectile container & update/draw helpers
const projectiles = [];

export function spawnProjectile(def) {
    projectiles.push(def);
}
export function updateProjectiles(dt, players, rectsIntersect, onHit) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.vx * (dt / 16.6667);
        p.y += p.vy * (dt / 16.6667);
        p.ttl -= dt;
        if (p.ttl <= 0) { projectiles.splice(i, 1); continue; }
        for (let pl of players) {
            if (pl === p.owner) continue;
            if (rectsIntersect(pl.getHurtbox(), p)) { onHit(pl, p); projectiles.splice(i, 1); break; }
        }
    }
}
export function drawProjectiles(ctx) {
    projectiles.forEach(p => { ctx.fillStyle = '#ffd26a'; ctx.fillRect(p.x, p.y, p.w, p.h); });
}
