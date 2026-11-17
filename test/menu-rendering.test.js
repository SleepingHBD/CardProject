import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const source = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function sourceFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const end = source.indexOf("\n}", start);
  assert.ok(end > start, `${name} has a function boundary`);
  return source.slice(start, end + 2);
}

test("the main menu removes only the covered duel and topbar from rendering", () => {
  assert.match(css, /body\.main-menu-active > \.topbar,\s*body\.main-menu-active > main\s*\{\s*display:\s*none\s*!important;\s*\}/);
  assert.match(html, /<header class="topbar">/);
  assert.match(html, /<main>/);
  assert.doesNotMatch(css, /body\.main-menu-active\s*>\s*\*/);
  assert.doesNotMatch(css, /four-lane|deck-editor/);
});

test("leaving a Normal Play duel stops background rendering without discarding its data", () => {
  const classes = new Set();
  const ui = Object.fromEntries(["mainMenuScreen", "difficultyDialog", "tutorialMenuDialog",
    "resultDialog", "previousRoundsHistoryDialog"].map(id => [id, { hidden: true, open: true }]));
  const state = { locked: false, round: 4, selectedCardIds: ["kept-card"], playerHand: ["kept-hand"] };
  const calls = [], closed = [];
  const context = {
    ui, state,
    document: { body: { classList: { add: name => classes.add(name) } } },
    stopTutorialMode: () => calls.push("stop-tutorial"),
    audio: { startMainMenuMusic: () => calls.push("menu-music") },
    closeGameMenu: options => calls.push(["close-game-menu", options.restoreFocus]),
    closeDialog: dialog => { closed.push(dialog); dialog.open = false; },
    setGameMenuVisibility: visible => calls.push(["game-menu", visible]),
  };
  runInNewContext(sourceFunction("showMainMenu") + "\nshowMainMenu();", context);
  assert.equal(classes.has("main-menu-active"), true);
  assert.equal(ui.mainMenuScreen.hidden, false);
  assert.equal(state.locked, true);
  assert.equal(state.round, 4);
  assert.deepEqual(state.selectedCardIds, ["kept-card"]);
  assert.deepEqual(state.playerHand, ["kept-hand"]);
  assert.ok(calls.includes("stop-tutorial"));
  assert.ok(calls.includes("menu-music"));
  assert.deepEqual(calls.filter(Array.isArray), [["close-game-menu", false], ["game-menu", false]]);
  assert.deepEqual(closed, [ui.difficultyDialog, ui.tutorialMenuDialog, ui.resultDialog, ui.previousRoundsHistoryDialog]);
});

test("the tutorial section menu uses the rendering guard and does not reopen an open dialog", () => {
  let mainMenuCalls = 0, opens = 0;
  const context = {
    ui: { tutorialMenuDialog: { open: false, showModal() { opens++; this.open = true; } } },
    showMainMenu: () => mainMenuCalls++,
  };
  runInNewContext(sourceFunction("showTutorialMenu") + "\nshowTutorialMenu(); showTutorialMenu();", context);
  assert.equal(mainMenuCalls, 2);
  assert.equal(opens, 1);
});

test("difficulty selection hides the main menu and restores the board without resetting the duel", () => {
  const classes = new Set(["main-menu-active"]), selectors = new Map();
  const state = { locked: false, round: 3, selectedCardIds: ["kept"] };
  let opens = 0;
  const context = {
    ui: { mainMenuScreen: { hidden: false }, difficultyDialog: { open: false, showModal() { opens++; this.open = true; } } },
    state, difficultyReturnTarget: null, difficultyPreviousLockedState: null,
    document: {
      body: { classList: { remove: name => classes.delete(name) } },
      querySelector: selector => {
        if (!selectors.has(selector)) selectors.set(selector, {});
        return selectors.get(selector);
      },
    },
    stopTutorialMode: () => {},
    closeGameMenu: () => {},
    setGameMenuVisibility: () => {},
  };
  runInNewContext(sourceFunction("showDifficultyChooser") + '\nshowDifficultyChooser("main");', context);
  assert.equal(classes.has("main-menu-active"), false);
  assert.equal(context.ui.mainMenuScreen.hidden, true);
  assert.equal(context.difficultyReturnTarget, "main");
  assert.equal(context.difficultyPreviousLockedState, false);
  assert.equal(state.locked, true);
  assert.equal(state.round, 3);
  assert.deepEqual(state.selectedCardIds, ["kept"]);
  assert.equal(opens, 1);
});

test("duel and tutorial entry points restore the visible board without retired lobby hooks", () => {
  for (const name of ["startTutorial", "showDifficultyChooser", "startGame"]) {
    assert.match(sourceFunction(name), /classList\.remove\("main-menu-active"\)/, `${name} must restore the visible board`);
  }
  assert.doesNotMatch(sourceFunction("showMainMenu"), /hideFourLanePreview|deckEditor|fourLaneRules/);
  assert.doesNotMatch(source, /function (?:showFourLanePreview|hideFourLanePreview|leaveFourLanePreview|startFourLaneDuel)\(/);
});
