import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gameSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("the tutorial curriculum covers all seven scenarios in teaching order", () => {
  const expectedOrder = [
    "TUTORIAL_LESSON_LIBRARY[0]",
    "TUTORIAL_LESSON_LIBRARY[3]",
    "TUTORIAL_LESSON_LIBRARY[1]",
    "TUTORIAL_LESSON_LIBRARY[2]",
    "TUTORIAL_LESSON_LIBRARY[4]",
    "TUTORIAL_LESSON_LIBRARY[5]",
    "TUTORIAL_LESSON_LIBRARY[6]",
  ];
  const curriculum = gameSource.match(
    /const TUTORIAL_LESSONS = Object\.freeze\(\[([\s\S]*?)\]\);/,
  )?.[1];

  assert.ok(curriculum, "tutorial curriculum should be declared");
  let previousPosition = -1;
  expectedOrder.forEach((entry) => {
    const position = curriculum.indexOf(entry);
    assert.ok(position > previousPosition, `${entry} should appear in curriculum order`);
    previousPosition = position;
  });
});

test("the tutorial includes card flow and a genuine free-choice Instinct lesson", () => {
  assert.match(gameSource, /id: "trophies-card-flow"/);
  assert.match(gameSource, /id: "instinct-practice"/);
  assert.match(gameSource, /freeChoice: true/);
  assert.match(gameSource, /difficulty: "instinct"/);
  assert.match(gameSource, /minCards: 2/);
  assert.match(gameSource, /maxCards: 3/);
  assert.match(gameSource, /recordTutorialRoundReward/);
});

test("the tutorial menu exposes every section with consecutive numbers", () => {
  const numberedOptions = [...pageSource.matchAll(
    /<span class="tutorial-menu-icon" aria-hidden="true">(\d)<\/span>/g,
  )].map((match) => Number(match[1]));

  assert.deepEqual(numberedOptions, [1, 2, 3, 4, 5, 6]);
  assert.match(pageSource, /data-tutorial-lesson="5"[\s\S]*Trophies &amp; Card Flow/);
  assert.match(pageSource, /data-tutorial-lesson="6"[\s\S]*Instinct Practice/);
});

test("tutorial navigation exposes keyboard focus and movable-panel controls", () => {
  assert.match(
    pageSource,
    /id="tutorialCoachDragHandle"[\s\S]*role="button"[\s\S]*tabindex="0"/,
  );
  assert.match(pageSource, /id="tutorialCoachTitle" tabindex="-1"/);
  assert.match(gameSource, /ui\.tutorialCoachDragHandle\.addEventListener\("keydown"/);
  assert.match(gameSource, /event\.key === "Home"/);
  assert.match(gameSource, /function focusTutorialHeading\(\)/);
});

test("Previous Rounds History is shared by normal duels and training", () => {
  assert.match(pageSource, /id="previousRoundsHistoryButton"[\s\S]*Previous Rounds History/);
  assert.match(pageSource, /id="previousRoundsHistoryDialog"/);
  assert.doesNotMatch(`${pageSource}\n${gameSource}`, /Duel Ledger/i);
  assert.match(gameSource, /function recordCompletedRound\(/);
  assert.match(
    gameSource,
    /function recordTutorialRoundReward[\s\S]*recordCompletedRound\(reward, playerCards, aiCards, resolution\)/,
  );
  assert.match(
    gameSource,
    /function completeRoundReward[\s\S]*recordCompletedRound\(reward, playerCards, aiCards, resolution\)/,
  );
});

test("Blind conceals live information while using persistent hidden habits", () => {
  assert.match(
    gameSource,
    /const concealsOpponentFormation[\s\S]*difficulty === "instinct" \|\| difficulty === "blind"/,
  );
  assert.match(
    gameSource,
    /state\.aiTraits = usesPersistentAiHabits\(\) \? createAiTraits\(\) : \[\]/,
  );
  assert.match(pageSource, /Blind[\s\S]*Identify his patterns through <b>Previous Rounds History<\/b>/);
});
