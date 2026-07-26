import test from "node:test";
import assert from "node:assert/strict";
import "../src/rules.js";

const {
  chooseAiCard,
  chooseAiCards,
  compareCards,
  forecastMatchup,
  getFormationReward,
  getPowerTier,
  hasWinningSet,
  resolveClashes,
} = globalThis.ClawRules;

const card = (element, power = 5, color = "red") => ({ element, power, color });

test("element circle resolves correctly", () => {
  assert.equal(compareCards(card("ember"), card("gust")), "player");
  assert.equal(compareCards(card("gust"), card("tide")), "player");
  assert.equal(compareCards(card("tide"), card("ember")), "player");
  assert.equal(compareCards(card("gust"), card("ember")), "ai");
});

test("same element compares power and can draw", () => {
  assert.equal(compareCards(card("ember", 8), card("ember", 4)), "player");
  assert.equal(compareCards(card("ember", 3), card("ember", 7)), "ai");
  assert.equal(compareCards(card("ember", 6), card("ember", 6)), "draw");
});

test("matchup forecasts identify counters and power duels", () => {
  assert.equal(forecastMatchup("ember", "gust"), "advantage");
  assert.equal(forecastMatchup("ember", "tide"), "danger");
  assert.equal(forecastMatchup("ember", "ember"), "power");
});

test("power tiers reveal useful ranges without exposing exact cards", () => {
  assert.deepEqual(getPowerTier(9), { key: "high", label: "High strength", range: "8-9" });
  assert.equal(getPowerTier(6).key, "steady");
  assert.equal(getPowerTier(3).key, "low");
});

test("three unique elements form a winning set", () => {
  assert.equal(
    hasWinningSet([card("ember"), card("gust"), card("tide")]),
    true,
  );
});

test("three different colors of one element form a winning set", () => {
  assert.equal(
    hasWinningSet([
      card("tide", 3, "red"),
      card("tide", 5, "blue"),
      card("tide", 8, "gold"),
    ]),
    true,
  );
});

test("duplicate colors do not count toward a mono-element win", () => {
  assert.equal(
    hasWinningSet([
      card("tide", 3, "blue"),
      card("tide", 5, "blue"),
      card("tide", 8, "gold"),
    ]),
    false,
  );
});

test("AI returns a valid card from its hand", () => {
  const hand = [card("ember", 2), card("gust", 9), card("tide", 4)];
  assert.ok(hand.includes(chooseAiCard(hand, [], [], () => 0.5)));
});

test("AI can choose up to three unique cards", () => {
  const hand = [
    card("ember", 2),
    card("gust", 9),
    card("tide", 4),
    card("ember", 7),
  ];
  const chosen = chooseAiCards(hand, 3, [], [], () => 0.5);

  assert.equal(chosen.length, 3);
  assert.equal(new Set(chosen).size, 3);
  assert.ok(chosen.every((selected) => hand.includes(selected)));
});

test("AI selection cannot exceed its available hand", () => {
  const hand = [card("ember", 2), card("gust", 9)];
  assert.equal(chooseAiCards(hand, 3, [], [], () => 0.5).length, 2);
  assert.deepEqual(chooseAiCards([], 3, [], [], () => 0.5), []);
});

test("multi-card formations resolve from left to right", () => {
  const playerCards = [
    card("ember", 5),
    card("tide", 4),
    card("gust", 8),
  ];
  const aiCards = [
    card("gust", 9),
    card("tide", 6),
    card("ember", 2),
  ];
  const resolution = resolveClashes(playerCards, aiCards);

  assert.deepEqual(resolution.results, ["player", "ai", "ai"]);
  assert.deepEqual(resolution.score, { player: 1, ai: 2, draw: 0 });
});

test("formation winner earns only their earliest winning card", () => {
  const playerCards = [card("ember"), card("gust"), card("tide")];
  const aiCards = [card("gust"), card("tide"), card("ember")];
  const resolution = resolveClashes(playerCards, aiCards);

  assert.deepEqual(
    getFormationReward(playerCards, aiCards, resolution),
    { winner: "player", card: playerCards[0], lane: 0 },
  );
});

test("an evenly split formation awards no trophy", () => {
  const playerCards = [card("ember", 5), card("gust", 5)];
  const aiCards = [card("gust", 5), card("ember", 5)];
  const resolution = resolveClashes(playerCards, aiCards);

  assert.deepEqual(
    getFormationReward(playerCards, aiCards, resolution),
    { winner: "draw", card: null, lane: -1 },
  );
});
