// small AI behaviors (export a single function used by game loop)
export function runAI(actor, opponent, dt, keysMock) {
    // actor.control === 'ai' expected
    // dt in ms scaled
    const dist = opponent.center() - actor.center();
    const absd = Math.abs(dist);
    // simple spacing & attack
    if (absd > 150) actor.vx = Math.sign(dist) * actor.def.speed;
    else actor.vx = 0;
    // attack decisions
    if (actor.actionTimer <= 0) {
        if (absd < 100 && Math.random() < 0.14) actor.tryMove('punch');
        else if (absd < 60 && Math.random() < 0.08) actor.tryMove('kick');
        else if (absd > 100 && Math.random() < 0.03 && actor.specialCooldown <= 0) {
            actor.tryMove('special');
        }
    }
}
