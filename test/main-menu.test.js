import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const pageSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const gameSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");

test("the main menu excludes the retired World Chronicle", () => {
  assert.doesNotMatch(pageSource, /id="mainMenuChronicleButton"/);
  assert.doesNotMatch(pageSource, /<script defer src="\.\/src\/chronicle\.js"><\/script>/);
});

test("the main menu retains Play, Tutorial, Rulebook and Settings navigation", () => {
  for (const id of ["mainMenuPlayButton", "mainMenuTutorialButton", "mainMenuRulebookButton", "mainMenuSettingsButton"]) {
    assert.match(pageSource, new RegExp(`id="${id}"`));
  }
  assert.match(gameSource, /mainMenuPlayButton\.addEventListener\("click", \(\) => showDifficultyChooser\("main"\)\)/);
  assert.match(gameSource, /mainMenuTutorialButton\.addEventListener\("click", showTutorialMenu\)/);
  assert.match(gameSource, /mainMenuRulebookButton\.addEventListener\("click", \(\) => ui\.rulebookDialog\.showModal\(\)\)/);
  assert.match(gameSource, /mainMenuSettingsButton\.addEventListener\("click", \(\) => openSettings\("main"\)\)/);
});

test("the removed WIP entry, lobby, editor and public-hand controls are absent", () => {
  assert.doesNotMatch(pageSource, /Super Secret Stuff|mainMenuFourLaneButton|fourLanePreview|fourLaneRules|deckEditor|publicDeck|opponentPublicHand|battleLaneNotice|matchScoreDetails/i);
  assert.doesNotMatch(gameSource, /ClawFourLane|ClawDeckbuilding|isFourLaneMode|startFourLaneDuel|fourLanePreview|deckEditor|publicDeck/i);
  assert.doesNotMatch(pageSource, /lobby-icon-/);
});

test("the removed mode has no shipped scripts, styles or dedicated runtime files", () => {
  const retired = ["four-lane-preview.css", "deckbuilding.css", "src/four-lane-rules.js",
    "src/four-lane-ai.js", "src/deckbuilding.js", "src/deck-editor.js", "src/opponents.js"];
  for (const path of retired) {
    assert.equal(existsSync(new URL("../" + path, import.meta.url)), false, `${path} must be removed, not merely hidden`);
    assert.ok(!pageSource.includes("./" + path), `${path} must not be loaded`);
  }
  assert.match(pageSource, /<script defer src="\.\/src\/rules\.js"><\/script>/);
  assert.match(pageSource, /<script defer src="\.\/src\/game\.js"><\/script>/);
});

test("the remaining game offers all three Normal Play difficulties and three lanes", () => {
  for (const difficulty of ["guided", "instinct", "blind"]) {
    assert.match(pageSource, new RegExp(`data-difficulty="${difficulty}"`));
  }
  assert.match(pageSource, /Commit 1–3 cards in order/);
  assert.match(pageSource, /Lane 1 fights Lane 1, Lane 2 fights Lane 2, and Lane 3 fights Lane 3/);
  assert.match(pageSource, /Collect 2 Fire \+ 2 Gust \+ 2 Water trophies/);
});

test("Rally remains available in the main archive and both in-game references", () => {
  assert.match(pageSource, /id="tactic-icon-banner"/);
  assert.match(pageSource, /Rally · gives \+1 to the card directly before it/);
  assert.match(pageSource, /<h3>Rally support \+1<\/h3>/);
  assert.match(pageSource, /<b>Rally support \+1<\/b>/);
  assert.match(pageSource, /60 cards across 36 characters/);
  assert.match(pageSource, /Power \+ Element Edge \+ Role \+ Rally received = Clash Total/);
});

test("the tutorial menu exposes Rally separately and retains continuous section numbering", () => {
  const menu = pageSource.match(/id="tutorialMenuOptions">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(menu);
  assert.match(menu, /data-tutorial-lesson="2"[\s\S]*?<strong>Rally Support<\/strong>/);
  assert.match(menu, /data-tutorial-lesson="3"[\s\S]*?<strong>Round Points<\/strong>/);
  assert.match(menu, /data-tutorial-lesson="6"[\s\S]*?<strong>Trophies &amp; Card Flow<\/strong>/);
  assert.match(menu, /data-tutorial-lesson="7"[\s\S]*?<strong>Instinct Practice<\/strong>/);
  assert.match(menu, /Tour plus all eight scenarios/);
  const numbers = [...menu.matchAll(/class="tutorial-menu-icon" aria-hidden="true">([1-7])<\/span>/g)].map(match => match[1]);
  assert.deepEqual(numbers, ["1", "2", "3", "4", "5", "6", "7"]);
});
