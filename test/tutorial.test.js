import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const gameSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("the tutorial curriculum covers all eight lessons in teaching order", () => {
  const expectedOrder = [
    "TUTORIAL_LESSON_LIBRARY[0]",
    "TUTORIAL_LESSON_LIBRARY[3]",
    "TUTORIAL_LESSON_LIBRARY[7]",
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

  assert.match(pageSource, /id="tutorialProgress">Lesson 1 of 8</);
  assert.match(gameSource, /`Lesson \$\{tutorial\.lessonIndex \+ 1\} of \$\{TUTORIAL_LESSONS\.length\}`/);
  assert.match(gameSource, /concept: "Round Points · Scenario 1 of 3"/);
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

  assert.deepEqual(numberedOptions, [1, 2, 3, 4, 5, 6, 7]);
  assert.match(pageSource, /data-tutorial-lesson="6"[\s\S]*Trophies &amp; Card Flow/);
  assert.match(pageSource, /data-tutorial-lesson="7"[\s\S]*Instinct Practice/);
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

test("Previous Rounds History uses an aligned tactical lane table instead of full cards", () => {
  const historyMarkupSource = gameSource.match(
    /function historyLaneCellMarkup\([\s\S]*?\n}\n\nfunction renderPreviousRoundsHistory/,
  )?.[0];

  assert.ok(historyMarkupSource, "history lane-table renderer should be declared");
  assert.match(historyMarkupSource, /history-lane-grid/);
  assert.match(historyMarkupSource, /history-cell-element/);
  assert.match(historyMarkupSource, /history-cell-power/);
  assert.match(historyMarkupSource, /history-cell-role/);
  assert.match(historyMarkupSource, /history-cell-stats/);
  assert.match(historyMarkupSource, /history-cell-outcome/);
  assert.doesNotMatch(historyMarkupSource, /history-cell-math/);
  assert.doesNotMatch(historyMarkupSource, /cardMarkup\(card\)/);
});

test("the shared deck repeats Common and Uncommon cards while premium cards are singletons", () => {
  const librarySource = gameSource.slice(gameSource.indexOf("const CARD_LIBRARY ="), gameSource.indexOf("const HAND_SIZE ="));
  const cards = JSON.parse(runInNewContext(librarySource + "\nJSON.stringify(CARD_LIBRARY)"));
  const copies = { common: 2, uncommon: 2, rare: 1, epic: 1, legendary: 1 };
  const physicalDeck = cards.flatMap((card) =>
    Array.from({ length: copies[card.rarity] }, () => card));
  const countBy = (property) => physicalDeck.reduce((counts, card) => ({
    ...counts,
    [card[property]]: (counts[card[property]] || 0) + 1,
  }), {});

  assert.equal(cards.length, 36);
  assert.equal(physicalDeck.length, 60);
  assert.deepEqual(countBy("element"), { ember: 20, gust: 20, tide: 20 });
  assert.deepEqual(countBy("tactic"), { link: 15, vanguard: 15, finisher: 15, rally: 15 });
  assert.deepEqual(countBy("rarity"), {
    epic: 3,
    rare: 6,
    uncommon: 24,
    legendary: 3,
    common: 24,
  });
  cards.forEach((card) => {
    assert.ok(
      existsSync(new URL(`../${card.artworkSource || "assets/cards/" + card.art + ".webp"}`, import.meta.url)),
      `${card.name} should have card art`,
    );
  });

  assert.match(
    gameSource,
    /const DECK_COPIES_BY_RARITY = Object\.freeze\(\{\s*common: 2,\s*uncommon: 2,\s*rare: 1,\s*epic: 1,\s*legendary: 1,/,
  );
  assert.match(gameSource, /CARD_LIBRARY\.flatMap\(\(card\) =>/);
  assert.match(
    pageSource,
    /shared draw pile contains 60 cards[\s\S]*two copies of every Common and Uncommon card[\s\S]*one copy of every Rare, Epic, and Legendary card/,
  );
});

test("Blind retains hidden habits while Instinct reveals them", () => {
  assert.match(
    gameSource,
    /const concealsOpponentFormation[\s\S]*difficulty === "instinct" \|\| difficulty === "blind"/,
  );
  assert.match(
    gameSource,
    /state\.aiTraits = usesPersistentAiHabits\(\) \? createAiTraits\(\) : \[\]/,
  );
  assert.match(gameSource, /const usesPersistentAiHabits[\s\S]*?difficulty === "instinct" \|\| difficulty === "blind"/);
  assert.match(pageSource, /Blind[\s\S]*Identify the opponent's patterns through <b>Previous Rounds History<\/b>/);
});
