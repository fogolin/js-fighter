// character definitions and simple accessors (exported)
export const characters = {
    alex: {
        id: 'alex', name: 'Alex', w: 48, h: 64, scale: 1.6, speed: 4, jump: -14,
        moves: {
            punch: { startup: 3, active: 4, recovery: 8, dmg: 8, hitbox: { x: 28, y: 14, w: 26, h: 16 } },
            kick: { startup: 4, active: 4, recovery: 10, dmg: 12, hitbox: { x: 24, y: 36, w: 36, h: 14 } },
            special: { startup: 10, active: 8, recovery: 26, dmg: 16, effect: 'projectile', proj: { w: 18, h: 10, speed: 9, dmg: 10 }, cooldown: 4800 }
        }
    },
    beth: {
        id: 'beth', name: 'Beth', w: 46, h: 62, scale: 1.8, speed: 3.6, jump: -13,
        moves: {
            punch: { startup: 2, active: 3, recovery: 10, dmg: 6, hitbox: { x: 26, y: 12, w: 24, h: 14 } },
            kick: { startup: 5, active: 3, recovery: 12, dmg: 10, hitbox: { x: 22, y: 38, w: 32, h: 12 } },
            special: { startup: 12, active: 8, recovery: 28, dmg: 18, effect: 'push', cooldown: 6000 }
        }
    }
};

export function getAvailableCharacters() { return Object.values(characters).map(c => ({ id: c.id, name: c.name })); }
export function getCharacterDef(id) { return characters[id]; }

export const stages = {
    cafe: { id: 'cafe', name: 'Local Café', floorColor: '#2a2318', layers: [] },
    park: { id: 'park', name: 'City Park', floorColor: '#31402a', layers: [] }
};
export function getAvailableStages() { return Object.values(stages).map(s => ({ id: s.id, name: s.name })); }

export function populateCharactersAndStages() { /* no-op for now, kept for API parity */ }
