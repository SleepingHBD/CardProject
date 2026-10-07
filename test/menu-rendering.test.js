import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const source = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("menu screens remove only the covered duel and topbar from rendering", () => {
  assert.match(css, /body\.main-menu-active > \.topbar,\s*body\.main-menu-active > main\s*\{\s*display:\s*none\s*!important;\s*\}/);
  assert.match(html, /<header class="topbar">/);
  assert.match(html, /<main>/);
  assert.doesNotMatch(css, /body\.main-menu-active\s*>\s*\*/);
});

for (const gameMode of ["normal", "four-lane"]) {
  test(`leaving a ${gameMode} duel enables the shared offscreen-rendering guard`, () => {
    const classes = new Set();
    const ui = Object.fromEntries(["mainMenuScreen", "difficultyDialog", "tutorialMenuDialog",
      "resultDialog", "previousRoundsHistoryDialog", "fourLaneRulesDialog"].map(id => [id, { hidden: true }]));
    const state = { gameMode, locked: false };
    const calls = [];
    const context = {
      ui, state,
      document: { body: { classList: { add: name => classes.add(name) } } },
      hideFourLanePreview: () => calls.push("close-lobby"),
      stopTutorialMode: () => calls.push("stop-tutorial"),
      audio: { startMainMenuMusic: () => calls.push("menu-music") },
      closeGameMenu: () => calls.push("close-game-menu"),
      closeDialog: dialog => { dialog.open = false; },
      setGameMenuVisibility: visible => calls.push(["game-menu", visible]),
    };
    const start = source.indexOf("function showMainMenu() {");
    const end = source.indexOf("function hideFourLanePreview()", start);
    assert.ok(start >= 0 && end > start);
    runInNewContext(`${source.slice(start, end)}\nshowMainMenu();`, context);
    assert.equal(classes.has("main-menu-active"), true);
    assert.equal(ui.mainMenuScreen.hidden, false);
    assert.equal(state.locked, true);
    assert.equal(state.gameMode, gameMode, "the guard does not alter the duel mode");
    assert.ok(calls.includes("close-lobby"));
  });
}

test("the four-lane lobby retains the guard while duel and tutorial entry restore the board", () => {
  const lobbyStart = source.indexOf('function showFourLanePreview(step = "deck")');
  const lobby = source.slice(lobbyStart, source.indexOf("function leaveFourLanePreview()", lobbyStart));
  assert.match(lobby, /showMainMenu\(\)/);
  assert.doesNotMatch(lobby, /classList\.remove\("main-menu-active"\)/);
  for (const name of ["startTutorial", "showDifficultyChooser", "startGame"]) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `Missing ${name} entry point`);
    const end = source.indexOf("\nfunction ", start + 1);
    const entry = source.slice(start, end < 0 ? source.length : end);
    assert.match(entry, /classList\.remove\("main-menu-active"\)/, `${name} must restore the visible board`);
  }
});
