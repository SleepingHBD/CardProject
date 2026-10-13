import test from "node:test";
import assert from "node:assert/strict";
import { rng } from "../scripts/audit-deckbuilding.js";
import { allowsPlacementPolicy, allowsBattlePlacementPolicy, prepareFormation, placementUtility, publicPlacementForecasts,
  choosePlacementProbe, simulatePlacementMatch, placementPolicies } from "../scripts/audit-placement-habits.js";

const four = globalThis.ClawFourLaneRules, keys = Object.keys(four.ELEMENTS);
const card = (random) => ({ element: keys[Math.floor(random() * 3)], power: 3 + Math.floor(random() * 7),
  tactic: ["vanguard", "link", "finisher", "rally"][Math.floor(random() * 4)] });
const formation = random => {
  const mask = 1 + Math.floor(random() * 15);
  return Array.from({ length: 4 }, (_, lane) => mask & 1 << lane ? card(random) : null);
};

test("the dedicated placement audit's independent utility matches the resolver across 5,000 sparse cases", () => {
  const random = rng(673987);
  for (let sample = 0; sample < 5000; sample++) {
    const own = keys.map(() => Math.floor(random() * 7)), other = keys.map(() => Math.floor(random() * 7));
    const cards = formation(random), forecast = formation(random);
    const toObject = values => Object.fromEntries(keys.map((key, index) => [key, values[index]]));
    const result = four.resolveProgress(cards, forecast, toObject(own), toObject(other));
    const expected = four.getMatchScore(result.progressAfter.player) - four.getMatchScore(result.progressBefore.player)
      - four.getMatchScore(result.progressAfter.ai) + four.getMatchScore(result.progressBefore.ai);
    assert.ok(Math.abs(placementUtility(prepareFormation(cards), prepareFormation(forecast), own, other) - expected) < 1e-10,
      `independent utility mismatch on case ${sample}`);
  }
});

test("audit camping and rotating policies restrict only their own plan, never scoring or enemy information", () => {
  for (let mask = 1; mask < 16; mask++) {
    const cards = Array.from({ length: 4 }, (_, lane) => mask & 1 << lane ? { element: "gust", power: 5 } : null);
    for (let lane = 1; lane <= 4; lane++) assert.equal(allowsPlacementPolicy(cards, `lane-${lane}`, 0), mask === 1 << lane - 1);
    for (const [policy, pair] of [["left-pair", 3], ["right-pair", 12], ["centre-pair", 6], ["outer-pair", 9]]) {
      assert.equal(allowsPlacementPolicy(cards, policy, 0), (mask & ~pair) === 0);
    }
    for (const [round, pair] of [3, 12, 6, 9].entries()) {
      assert.equal(allowsPlacementPolicy(cards, "rotating-pair", round), (mask & ~pair) === 0);
    }
    for (const [policy, triple] of [["left-three", 7], ["right-three", 14], ["outer-left-three", 11], ["outer-right-three", 13]]) {
      assert.equal(allowsPlacementPolicy(cards, policy, 0), (mask & ~triple) === 0);
    }
    for (const [round, triple] of [7, 14, 11, 13].entries()) {
      assert.equal(allowsPlacementPolicy(cards, "rotating-three", round), (mask & ~triple) === 0);
    }
    assert.equal(allowsPlacementPolicy(cards, "full-push", 0), true);
    assert.equal(allowsPlacementPolicy(cards, "adaptive", 0), true);
  }
  assert.equal(placementPolicies.length, 16);
});

test("public placement forecasts have mass one, use canonical visible lanes and cannot access a current private plan", () => {
  const trait = four.AI_PLACEMENT_TRAITS[0];
  const history = [{ playerCards: [null, { power: 5, element: "tide", tactic: "link" }, null, null],
    aiCards: [{ power: 5, element: "gust", tactic: "link" }, null, { power: 4, element: "ember", tactic: "rally" }, null] }];
  const before = JSON.stringify(history);
  const poison = history.map(entry => ({ ...entry,
    aiPlan: new Proxy({}, { get() { throw new Error("private current plan accessed"); } }),
    hand: new Proxy({}, { get() { throw new Error("private hand accessed"); } }) }));
  const scenarios = publicPlacementForecasts(poison, trait, rng(7));
  assert.ok(Math.abs(scenarios.reduce((sum, value) => sum + value.weight, 0) - 1) < 1e-12);
  const pairs = scenarios.filter(value => value.count === 2);
  const favoured = pairs.filter(value => four.isPreferredPlacement(value.cards, trait)).reduce((sum, value) => sum + value.weight, 0);
  const allPairs = pairs.reduce((sum, value) => sum + value.weight, 0);
  assert.ok(favoured / allPairs >= .8, "known public tendency informs every audit policy equally");
  assert.equal(JSON.stringify(history), before);
  const hand = Object.freeze(Array.from({ length: 5 }, () => Object.freeze({ power: 5, element: "gust", tactic: "none" })));
  const chosen = choosePlacementProbe(hand, {}, {}, "right-pair", 0, poison, trait, rng(4));
  assert.ok(chosen.filter(Boolean).every(card => hand.includes(card)));
  assert.equal(four.getFormationMask(chosen) & ~12, 0);
});

test("current paired camping controls conserve cards, obey the required lane and end at eight rounds", () => {
  for (const policy of ["lane-1", "rotating-pair", "adaptive"]) {
    const report = simulatePlacementMatch(0, 0, policy, 397463);
    assert.ok(["player", "opponent", "draw"].includes(report.winner));
    assert.equal(report.rounds, 8);
    assert.equal(report.roundLimitDraw, false, "a normal score tie is not a safety-limit failure");
    assert.equal(report.opponentCounts.reduce((sum, count) => sum + count, 0), report.rounds);
    assert.equal(report.totalByCount.reduce((sum, count) => sum + count, 0) + report.opponentCounts[3], report.rounds,
      "full formations are excluded from meaningful placement consistency");
  }
});

test("all current audit policies obey the mandatory lane, including nominal camping regions", () => {
  for (let round = 0; round < 8; round++) for (const policy of placementPolicies) {
    for (let mask = 1; mask < 16; mask++) {
      const cards = Array.from({ length: 4 }, (_, lane) => mask & 1 << lane ? { element: "gust", power: 5 } : null);
      if (!(mask & 1 << four.getBattleLane(round + 1))) assert.equal(allowsBattlePlacementPolicy(cards, policy, round), false);
    }
    const single = Array(4).fill(null); single[four.getBattleLane(round + 1)] = { element: "gust", power: 5 };
    assert.equal(allowsBattlePlacementPolicy(single, policy, round), true);
  }
});
