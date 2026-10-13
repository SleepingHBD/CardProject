import test from "node:test";
import assert from "node:assert/strict";
import "../src/rules.js";
import "../src/four-lane-rules.js";
import "../src/four-lane-ai.js";

const rules = globalThis.ClawFourLaneRules, ai = globalThis.ClawFourLaneAi;
const random = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const elements = ["ember", "gust", "tide"], roles = ["vanguard", "link", "finisher", "rally"];
const hand = (seed, size = 7) => {
  const roll = random(seed);
  return Object.freeze(Array.from({ length: size }, () => Object.freeze({
    element: elements[Math.floor(roll() * 3)], tactic: roles[Math.floor(roll() * 4)], power: 3 + Math.floor(roll() * 7),
  })));
};
const progress = roll => Object.fromEntries(elements.map(element => [element, Math.floor(roll() * 25)]));
const slots = (cards, roll) => {
  const available = [...cards], result = Array(4).fill(null);
  const count = 1 + Math.floor(roll() * Math.min(4, cards.length));
  const lanes = [0, 1, 2, 3];
  for (let index = 0; index < count; index++) {
    const [lane] = lanes.splice(Math.floor(roll() * lanes.length), 1);
    result[lane] = available.splice(Math.floor(roll() * available.length), 1)[0];
  }
  return result;
};

test("numeric AI payoff matches independent live scoring across roles, gaps and uncapped collections", () => {
  const roll = random(49831);
  for (let index = 0; index < 10000; index++) {
    const own = slots(hand(index * 17 + 1), roll), other = slots(hand(index * 13 + 2), roll);
    const before = progress(roll), opposingBefore = progress(roll);
    const result = rules.resolveProgress(own, other, before, opposingBefore);
    const expected = rules.getMatchScore(result.progressAfter.player) - rules.getMatchScore(before)
      - rules.getMatchScore(result.progressAfter.ai) + rules.getMatchScore(opposingBefore);
    assert.equal(ai.evaluateFormation(own, other, before, opposingBefore), expected);
    assert.equal(ai.evaluateFormation(other, own, opposingBefore, before), expected ? -expected : 0);
  }
});

test("every public-hand plan is owned, unique and occupies the shared battle lane", () => {
  for (let size = 1; size <= 7; size++) for (let round = 1; round <= 8; round++) {
    const own = hand(size * 101 + round, size), other = hand(size * 911 + round, 8 - size);
    const before = JSON.stringify([own, other]);
    const plan = ai.chooseFormation(own, other, { ember: 14, gust: 2, tide: 5 }, { ember: 4, gust: 9, tide: 1 }, round, random(size * 19 + round));
    const played = plan.filter(Boolean);
    assert.equal(plan.length, 4);
    assert.ok(plan[rules.getBattleLane(round)]);
    assert.ok(played.length >= 1 && played.length <= Math.min(4, size));
    assert.equal(new Set(played).size, played.length);
    assert.ok(played.every(card => own.includes(card)));
    assert.equal(JSON.stringify([own, other]), before);
  }
});

test("planner reads public card fields only and has no chosen-formation/deck input", () => {
  const publicCard = (power, element, tactic) => new Proxy(Object.freeze({ power, element, tactic }), {
    get(target, property) {
      assert.ok(["power", "element", "tactic"].includes(property), `Unexpected card read: ${String(property)}`);
      return target[property];
    },
  });
  const own = [publicCard(6, "ember", "vanguard"), publicCard(4, "tide", "rally")];
  const other = [publicCard(5, "gust", "link"), publicCard(3, "ember", "finisher")];
  const plan = ai.chooseFormation(own, other, {}, {}, 1, random(1));
  assert.ok(plan[1]);
  assert.ok(plan.filter(Boolean).every(card => own.includes(card)));
});

test("seeded choices are reproducible without modifying frozen progress or hands", () => {
  const own = hand(1963), other = hand(1947);
  const a = Object.freeze({ ember: 5, gust: 4, tide: 6 }), b = Object.freeze({ ember: 12, gust: 2, tide: 0 });
  const first = ai.chooseFormation(own, other, a, b, 3, random(412));
  const second = ai.chooseFormation(own, other, a, b, 3, random(412));
  assert.deepEqual(first, second);
  assert.deepEqual(a, { ember: 5, gust: 4, tide: 6 });
  assert.deepEqual(b, { ember: 12, gust: 2, tide: 0 });
});

test("solver exposes a normalized finite mixture with legal candidate plans", () => {
  const own = hand(52351), other = hand(6124), strategy = ai.analyse(own, other, {}, {}, 8, random(529));
  assert.ok(Number.isFinite(strategy.gap) && strategy.gap >= -1e-9);
  assert.ok(Math.abs(strategy.probabilities.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
  assert.ok(strategy.probabilities.every(value => Number.isFinite(value) && value >= 0));
  assert.equal(strategy.plans.length, strategy.probabilities.length);
  assert.ok(strategy.legalCounts[0] >= strategy.candidateCounts[0]);
  assert.ok(strategy.plans.every(plan => plan[2] && plan.filter(Boolean).every(card => own.includes(card))));
});

test("a sole card still satisfies the mandatory lane and can earn an uncapped victory", () => {
  const own = [Object.freeze({ power: 9, element: "ember", tactic: "finisher" })];
  const other = [Object.freeze({ power: 3, element: "gust", tactic: "rally" })];
  for (let round = 1; round <= 8; round++) {
    const plan = ai.chooseFormation(own, other, { ember: 20 }, {}, round, random(round));
    const opposing = Array(4).fill(null); opposing[rules.getBattleLane(round)] = other[0];
    const result = rules.resolveProgress(plan, opposing, { ember: 20 });
    assert.equal(result.progressAfter.player.ember, 22);
  }
});

test("symmetric counterplay keeps multiple placements in the strategy mixture", () => {
  const own = Object.freeze([
    Object.freeze({ power: 5, element: "ember", tactic: "vanguard" }),
    Object.freeze({ power: 5, element: "gust", tactic: "link" }),
    Object.freeze({ power: 5, element: "tide", tactic: "finisher" }),
  ]);
  const strategy = ai.analyse(own, own, {}, {}, 1, random(387));
  assert.ok(strategy.probabilities.filter(weight => weight > 0).length > 1,
    "The planner must not always expose one deterministic counterable formation.");
});

test("invalid public hands, rounds and random values are rejected", () => {
  const own = hand(201), other = hand(305);
  for (const bad of [[], Array(1), [own[0], own[0]], hand(702, 8), [{ power: NaN, element: "gust" }]]) {
    assert.throws(() => ai.chooseFormation(bad, other), RangeError);
    assert.throws(() => ai.chooseFormation(own, bad), RangeError);
  }
  for (const bad of [0, 9, 1.5, NaN]) assert.throws(() => ai.chooseFormation(own, other, {}, {}, bad), RangeError);
  assert.throws(() => ai.chooseFormation(own, other, {}, {}, 1, () => NaN), TypeError);
});
