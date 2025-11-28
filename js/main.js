// Entry point: initializes modules, UI, and starts loop
import { setupInput } from './input.js';
import { createSplash, createMenu } from './ui.js';
import { startGameLoop, stopGameLoop, setCanvas } from './game.js';
import { populateCharactersAndStages } from './characters.js';
import { renderHUDUpdate } from './hud.js';

const canvas = document.getElementById('game');
setCanvas(canvas);

setupInput();

populateCharactersAndStages(); // registers defaults used by menu

createSplash(() => {
    // on splash dismiss -> open select menu
    createMenu({
        onStartMatch: (options) => {
            // options: { p1, p2, stage, p2IsAI }
            // start the game loop and pass options to game module
            startGameLoop(options);
        }
    });
});

// expose for debugging
window.RetroPunch = { startGameLoop, stopGameLoop, renderHUDUpdate };
