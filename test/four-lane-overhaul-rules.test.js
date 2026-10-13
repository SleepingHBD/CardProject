import test from "node:test";
import assert from "node:assert/strict";
import "../src/rules.js";
import "../src/four-lane-rules.js";

const rules = globalThis.ClawFourLaneRules, normal = globalThis.ClawRules;
const progress = (ember = 0, gust = 0, tide = 0) => ({ ember, gust, tide });
let nextId = 0;
const card = (element = "ember", power = 5, tactic = "none") => Object.freeze({ element, power, tactic, instanceId: `test-${++nextId}` });
const slots = (...cards) => [...cards, ...Array(4 - cards.length).fill(null)];

test("only the WIP has eight rounds and a two-point complete-element-set bonus", () => {
  assert.equal(rules.MATCH_ROUNDS, 8);
  assert.equal(rules.MAX_MATCH_ROUNDS, 8);
  assert.equal(rules.MAX_ROUNDS, 8);
  assert.equal(rules.SET_BONUS, 2);
  assert.equal(normal.MAX_COMMITMENT, 3);
  assert.equal(normal.TROPHIES_PER_ELEMENT, 2);
});

test("the mandatory battle lane alternates between physical Lanes 2 and 3", () => {
  assert.deepEqual(Array.from({ length: 8 }, (_, index) => rules.getBattleLane(index + 1)), [1, 2, 1, 2, 1, 2, 1, 2]);
  assert.equal(rules.getBattleLane(), 1);
  for (const invalid of [0, -1, 1.5, NaN, Infinity, "1", null]) {
    assert.throws(() => rules.getBattleLane(invalid), RangeError);
    assert.equal(rules.isValidBattleFormation(slots(null, card()), invalid), false);
  }
});

test("required-lane validation accepts precisely the eight occupancy masks containing it", () => {
  for (let round = 1; round <= 8; round++) {
    let legal = 0;
    for (let mask = 0; mask < 16; mask++) {
      const formation = Array.from({ length: 4 }, (_, lane) => mask & (1 << lane) ? card() : null);
      const expected = Boolean(mask & (1 << rules.getBattleLane(round)));
      assert.equal(rules.isValidBattleFormation(formation, round), expected);
      legal += Number(expected);
    }
    assert.equal(legal, 8);
  }
  assert.equal(rules.isValidBattleFormation([null, card()], 1), true);
  assert.equal(rules.isValidBattleFormation([null, null, card()], 2), true);
  assert.equal(rules.isValidBattleFormation([card()], 1), false);
});

test("battle formations reject missing, oversized, malformed and reused physical cards", () => {
  const shared = card();
  for (const formation of [null, [], Array(4).fill(null), Array(5).fill(null),
    slots(null, { element: "invalid", power: 5 }), slots(null, { element: "ember", power: NaN }),
    slots(shared, shared), slots({ ...shared }, { ...shared })]) {
    assert.equal(rules.isValidBattleFormation(formation), false);
  }
  const first = card(), second = card();
  assert.equal(rules.isValidBattleFormation(slots(first, second)), true, "two copies of a definition are distinct cards");
});

test("trophy counters normalize to nonnegative finite integers without a six-trophy ceiling", () => {
  assert.deepEqual(rules.getElementProgress(progress(23, 8, 16)), progress(23, 8, 16));
  assert.deepEqual(rules.getElementProgress({ ember: -8, gust: 4.9, tide: "11" }), progress(0, 4, 11));
  assert.deepEqual(rules.getElementProgress({ ember: Infinity, gust: NaN, tide: -Infinity }), progress());
  assert.deepEqual(rules.getElementProgress(null), progress());
  assert.equal(rules.getProgressTotal(progress(10, 20, 30)), 60);
});

test("complete sets reward balanced collection but excess trophies retain their value", () => {
  assert.equal(rules.getCompletedSets(progress(7, 5, 3)), 3);
  assert.equal(rules.getSetBonus(progress(7, 5, 3)), 6);
  assert.equal(rules.getMatchScore(progress(7, 5, 3)), 21);
  assert.equal(rules.getMatchScore(progress(8, 0, 0)), 8);
  assert.equal(rules.getMatchScore(progress(2, 2, 2)), 10);
  assert.equal(rules.getMatchScore(progress(6, 6, 6)), 30);
});

test("four same-element wins award eight trophies even after the old six threshold", () => {
  const player = Array.from({ length: 4 }, () => card("ember", 9));
  const ai = Array.from({ length: 4 }, () => card("ember", 3));
  const result = rules.resolveProgress(player, ai, progress(6));
  assert.deepEqual(result.laneProgress.player, [2, 2, 2, 2]);
  assert.deepEqual(result.progressGains.player, progress(8));
  assert.deepEqual(result.progressAfter.player, progress(14));
  assert.equal(result.score.player, 8);
  assert.equal(result.matchWinner, null);
});

test("elemental edge and role-plus-Rally stacking remain unchanged", () => {
  const player = slots(null, card("ember", 5, "vanguard"), card("tide", 3, "rally"));
  const ai = slots(null, card("gust", 8));
  const result = rules.resolveProgress(player, ai);
  assert.equal(result.lanes[1].player.edge, 2);
  assert.equal(result.lanes[1].player.tactic, 1);
  assert.equal(result.lanes[1].player.rally, 1);
  assert.equal(result.lanes[1].player.total, 9);
  assert.equal(result.lanes[1].winner, "player");
  assert.deepEqual(result.progressGains.player, progress(2, 0, 1));
});

test("extra trophies require victories, are capped at two, and credit left to right", () => {
  assert.equal(rules.getExtraCardPoints(4, 0, 4), 2);
  const player = slots(card("ember", 3), card("gust", 9), card("tide", 3), card("ember", 4));
  const ai = slots(null, card("gust", 3));
  const result = rules.resolveProgress(player, ai, progress(20, 20, 20));
  assert.deepEqual(result.extraCardLanePoints.player, [1, 0, 0, 0]);
  assert.deepEqual(result.progressGains.player, progress(1, 2));
  const draw = rules.resolveProgress(player, slots(null, card("gust", 9)), progress(20, 20, 20));
  assert.deepEqual(draw.progressGains.player, progress());
  assert.equal(draw.extraCardPoints.player, 0);
});

test("no trophy totals end the match early; the eighth round compares total plus set bonus", () => {
  for (let completed = 0; completed < 8; completed++) {
    assert.equal(rules.getProgressMatchWinner(progress(100, 100, 100), progress(), completed), null);
  }
  assert.equal(rules.getProgressMatchWinner(progress(2, 2, 2), progress(8), 8), "player");
  assert.equal(rules.getProgressMatchWinner(progress(8), progress(2, 2, 2), 8), "ai");
  assert.equal(rules.getProgressMatchWinner(progress(10), progress(2, 2, 2), 8), "draw");
  assert.equal(rules.getProgressMatchWinner(progress(9), progress(2, 2, 2), 9), "ai");
  const player = slots(null, card("ember", 9)), ai = slots(null, card("ember", 3));
  const clash = rules.resolveClashes(player, ai);
  assert.equal(rules.resolveProgress(player, ai, progress(), progress(), clash, 7).matchWinner, null);
  assert.equal(rules.resolveProgress(player, ai, progress(), progress(), clash, 8).matchWinner, "player");
});

test("10,000 scoreboard pairs have symmetric winners and exact uncapped set arithmetic", () => {
  let seed = 82973;
  const roll = n => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % n;
  for (let sample = 0; sample < 10000; sample++) {
    const a = progress(roll(100), roll(100), roll(100)), b = progress(roll(100), roll(100), roll(100));
    const independent = p => p.ember + p.gust + p.tide + 2 * Math.min(p.ember, p.gust, p.tide);
    assert.equal(rules.getMatchScore(a), independent(a));
    assert.equal(rules.getMatchScore(b), independent(b));
    const winner = independent(a) === independent(b) ? "draw" : independent(a) > independent(b) ? "player" : "ai";
    assert.equal(rules.getProgressMatchWinner(a, b, 8), winner);
    assert.equal(rules.getProgressMatchWinner(b, a, 8), winner === "draw" ? "draw" : winner === "player" ? "ai" : "player");
  }
});
