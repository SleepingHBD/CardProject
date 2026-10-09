import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const pageSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const gameSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");

function sourceFunction(name) {
  const start = gameSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  return gameSource.slice(start, gameSource.indexOf("\n}", start) + 2);
}

test("the main menu excludes the retired World Chronicle", () => {
  assert.doesNotMatch(pageSource, /id="mainMenuChronicleButton"/);
  assert.doesNotMatch(pageSource, /<script defer src="\.\/src\/chronicle\.js"><\/script>/);
});

test("the main menu retains its playable navigation", () => {
  assert.match(pageSource, /id="mainMenuPlayButton"/);
  assert.match(pageSource, /id="mainMenuTutorialButton"/);
  assert.match(pageSource, /id="mainMenuRulebookButton"/);
  assert.match(pageSource, /id="mainMenuSettingsButton"/);
});

test("the four-lane entry leads to a separate, initially hidden playable prototype lobby", () => {
  assert.match(pageSource, /id="mainMenuFourLaneButton"[\s\S]*?aria-controls="fourLanePreviewScreen"/);
  assert.match(pageSource, /id="fourLanePreviewScreen"[\s\S]*?aria-labelledby="fourLanePreviewTitle"[\s\S]*?hidden/);
  assert.match(pageSource, /WIP · Balance testing in progress/);
  assert.match(pageSource, /id="fourLaneStartButton"/);
  assert.match(pageSource, /id="fourLaneRulesDialog"/);
  assert.match(gameSource, /fourLaneStartButton\.addEventListener\("click", \(\) => showDifficultyChooser\("four-lane"\)\)/);
  assert.match(pageSource, /Normal Play is unchanged/);
  assert.equal((pageSource.match(/class="four-lane-preview-slot(?: is-new-lane)?"/g) || []).length, 8);
  assert.match(gameSource, /mainMenuFourLaneButton\.addEventListener\("click", \(\) => showFourLanePreview\(\)\)/);
  assert.match(gameSource, /mainMenuPlayButton\.addEventListener\("click", \(\) => showDifficultyChooser\("main"\)\)/);
});

test("the experimental mode uses Super Secret Stuff WIP without changing its internal identity", () => {
  assert.match(pageSource, /aria-label="Super Secret Stuff WIP"/);
  assert.match(pageSource, /<span>Super Secret Stuff<\/span><span class="four-lane-menu-badge" aria-hidden="true">WIP<\/span>/);
  assert.match(pageSource, /id="fourLanePreviewTitle" tabindex="-1">Super Secret Stuff WIP<\/h1>/);
  assert.match(pageSource, /Super Secret Stuff WIP · Deckbuilding/);
  assert.match(pageSource, /Close Super Secret Stuff WIP rules/);
  assert.doesNotMatch(pageSource, /Four-Lane Mode|Four-Lane Rules/);
  assert.match(sourceFunction("renderDuelMode"), /isFourLaneMode\(\) \? "Super Secret Stuff WIP" : "Trial of the Elements"/);
  assert.match(sourceFunction("isFourLaneMode"), /state\.gameMode === "four-lane"/);
});

test("opening and leaving the preview preserves duel data and restores background focusability", () => {
  const background = [{ inert: false }, { inert: true }];
  const state = { selectedCardIds: ["kept-card"], playerHand: ["kept-hand"], round: 4, locked: true };
  const snapshot = JSON.stringify(state);
  let menuCalls = 0;
  let headingFocus = 0;
  let buttonFocus = 0;
  const ui = {
    mainMenuScreen: { hidden: false },
    fourLanePreviewScreen: { hidden: true, scrollTop: 84 },
    fourLanePreviewTitle: { focus: () => { headingFocus++; } },
    fourLaneDeckChoiceTitle: { focus: () => { headingFocus++; } },
    fourLaneDeckPage: {}, fourLaneRivalPage: {},
    fourLaneDeckStep: { removeAttribute() {}, setAttribute() {} },
    fourLaneRivalStep: { removeAttribute() {}, setAttribute() {} },
    mainMenuFourLaneButton: { focus: () => { buttonFocus++; } },
  };
  const context = {
    ui, state, fourLanePreviewBackground: [],
    renderFourLaneCards: () => {},
    renderFourLaneOpponents: () => {},
    fourLaneDeckEditor: { close: () => {}, renderLobby: () => {} },
    document: { querySelectorAll: () => background },
    showMainMenu: () => {
      menuCalls++;
      runInNewContext("hideFourLanePreview()", context);
      ui.mainMenuScreen.hidden = false;
    },
  };
  runInNewContext([
    sourceFunction("hideFourLanePreview"),
    sourceFunction("showFourLaneLobbyStep"),
    sourceFunction("showFourLanePreview"),
    sourceFunction("leaveFourLanePreview"),
    "showFourLanePreview()",
  ].join("\n"), context);
  assert.equal(ui.mainMenuScreen.hidden, true);
  assert.equal(ui.fourLanePreviewScreen.hidden, false);
  assert.equal(ui.fourLaneDeckPage.hidden, false);
  assert.equal(ui.fourLaneRivalPage.hidden, true);
  assert.equal(ui.fourLanePreviewScreen.scrollTop, 0);
  assert.equal(headingFocus, 1);
  assert.deepEqual(background.map(element => element.inert), [true, true]);
  runInNewContext("leaveFourLanePreview()", context);
  assert.equal(ui.mainMenuScreen.hidden, false);
  assert.equal(ui.fourLanePreviewScreen.hidden, true);
  assert.deepEqual(background.map(element => element.inert), [false, true]);
  assert.equal(buttonFocus, 1);
  assert.equal(menuCalls, 2);
  assert.equal(JSON.stringify(state), snapshot);
  assert.match(sourceFunction("showMainMenu"), /hideFourLanePreview\(\)/);
});

test("Escape and Return both leave the preview, using existing button audio", () => {
  assert.match(gameSource, /fourLaneReturnButton\.addEventListener\("click", leaveFourLanePreview\)/);
  assert.match(gameSource, /fourLanePreviewScreen\.addEventListener\("keydown", \(event\) => \{[\s\S]*?event\.key !== "Escape"[\s\S]*?leaveFourLanePreview\(\)/);
  assert.match(gameSource, /document\.addEventListener\("click",[\s\S]*?audio\.buttonPress\(\)/);
});
