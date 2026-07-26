import test from "node:test";
import assert from "node:assert/strict";
import "../src/rules.js";

const {
  CHAIN_BONUS,
  ELEMENT_EDGE_BONUS,
  chooseAiCard,
  chooseAiCommitment,
  chooseAiCards,
  compareCards,
  forecastMatchup,
  getChainBonus,
  getFormationReward,
  getFocusBonus,
  getPowerTier,
  hasWinningSet,
  resolveClashes,
  scoreClash,
} = globalThis.ClawRules;

const card = (element, power = 5, color = "red") => ({ element, power, color });

test("element advantage adds a two-point edge", () => {
  assert.equal(ELEMENT_EDGE_BONUS, 2);
  assert.equal(compareCards(card("ember"), card("gust")), "player");
  assert.equal(compareCards(card("gust"), card("tide")), "player");
  assert.equal(compareCards(card("tide"), card("ember")), "player");
  assert.equal(compareCards(card("gust"), card("ember")), "ai");
});

test("an elemental counter is strong but not an automatic win", () => {
  assert.equal(compareCards(card("ember", 3), card("gust", 9)), "ai");
  assert.deepEqual(
    scoreClash(card("ember", 3), card("gust", 9)),
    {
      player: { base: 3, edge: 2, chain: 0, focus: 0, total: 5 },
      ai: { base: 9, edge: 0, chain: 0, focus: 0, total: 9 },
    },
  );
});

test("same element compares power and can draw", () => {
  assert.equal(compareCards(card("ember", 8), card("ember", 4)), "player");
  assert.equal(compareCards(card("ember", 3), card("ember", 7)), "ai");
  assert.equal(compareCards(card("ember", 6), card("ember", 6)), "draw");
});

test("changing elements between lanes earns a one-point chain bonus", () => {
  const formation = [card("ember", 5), card("tide", 5), card("tide", 5)];
  assert.equal(CHAIN_BONUS, 1);
  assert.equal(getChainBonus(formation, 0), 0);
  assert.equal(getChainBonus(formation, 1), 1);
  assert.equal(getChainBonus(formation, 2), 0);
  assert.equal(compareCards(card("tide", 5), card("tide", 5), 1, 0), "player");
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

test("AI independently chooses commitments from one to three cards", () => {
  assert.equal(chooseAiCommitment(6, [], [], () => 0.1), 1);
  assert.equal(chooseAiCommitment(6, [], [], () => 0.5), 2);
  assert.equal(chooseAiCommitment(6, [], [], () => 0.9), 3);
  assert.equal(chooseAiCommitment(1, [], [], () => 0.9), 1);
});

test("fewer committed cards gain Focus", () => {
  assert.equal(getFocusBonus(1), 2);
  assert.equal(getFocusBonus(2), 1);
  assert.equal(getFocusBonus(3), 0);
  assert.equal(
    scoreClash(card("ember", 4), card("ember", 5), 0, 0, 2, 0).player.total,
    6,
  );
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

  assert.deepEqual(resolution.results, ["ai", "ai", "player"]);
  assert.deepEqual(resolution.score, { player: 1, ai: 2, draw: 0 });
  assert.deepEqual(
    resolution.lanes.map((lane) => [lane.player.total, lane.ai.total]),
    [[7, 9], [5, 7], [9, 5]],
  );
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

test("a smaller focused formation can beat a larger commitment", () => {
  const playerCards = [card("ember", 5)];
  const aiCards = [card("gust", 6), card("tide", 8), card("ember", 8)];
  const resolution = resolveClashes(playerCards, aiCards);

  assert.equal(resolution.lanes[0].player.total, 9);
  assert.equal(resolution.lanes[0].ai.total, 6);
  assert.equal(resolution.winner, "player");
  assert.equal(resolution.decidedBy, "clashes");
});

test("the larger commitment uses Pressure to break a tied clash score", () => {
  const playerCards = [card("ember", 5), card("gust", 5)];
  const aiCards = [
    card("gust", 6),
    card("ember", 5),
    card("tide", 7),
  ];
  const resolution = resolveClashes(playerCards, aiCards);

  assert.deepEqual(resolution.score, { player: 1, ai: 1, draw: 0 });
  assert.equal(resolution.winner, "ai");
  assert.equal(resolution.decidedBy, "pressure");
  assert.deepEqual(
    getFormationReward(playerCards, aiCards, resolution),
    { winner: "ai", card: aiCards[2], lane: 2 },
  );
});

test("equal commitments still draw when clash scores are tied", () => {
  const playerCards = [card("ember", 5), card("gust", 5)];
  const aiCards = [card("gust", 6), card("ember", 5)];
  const resolution = resolveClashes(playerCards, aiCards);

  assert.equal(resolution.winner, "draw");
  assert.equal(resolution.decidedBy, "draw");
});
