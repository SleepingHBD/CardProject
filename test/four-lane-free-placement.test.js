import test from "node:test";
import assert from "node:assert/strict";
import "../src/rules.js";
import "../src/four-lane-rules.js";

const rules = globalThis.ClawFourLaneRules, normal = globalThis.ClawRules;
const elements = ["ember", "gust", "tide"], beats = { ember: "gust", gust: "tide", tide: "ember" };
const card = (element = "ember", power = 5, tactic = "none", instanceId = "qa") => ({ element, power, tactic, instanceId });
const progress = (ember = 0, gust = 0, tide = 0) => ({ ember, gust, tide });
const slots = (...cards) => [...cards, ...Array(4 - cards.length).fill(null)];
const occupied = formation => formation.filter(Boolean);

// Deliberately independent of the production role, scoring and placement helpers.
function oracle(a, b, pa = progress(), pb = progress()) {
  const formations = [a, b], after = [{ ...pa }, { ...pb }], gains = [progress(), progress()], wins = [0, 0];
  const laneGains = [Array(4).fill(0), Array(4).fill(0)], extra = [Array(4).fill(0), Array(4).fill(0)];
  const totals = formations.map(formation => {
    const count = occupied(formation).length, first = formation.findIndex(Boolean), last = formation.findLastIndex(Boolean);
    return formation.map((value, lane) => !value ? 0 : value.power
      + Number(value.tactic === "vanguard" && count >= 2 && lane === first
        || value.tactic === "link" && formation[lane - 1] && formation[lane - 1].element !== value.element
        || value.tactic === "finisher" && count >= 2 && lane === last)
      + Number(formation[lane + 1]?.tactic === "rally"));
  });
  const award = (side, lane, amount) => {
    const element = formations[side][lane].element, gain = Math.min(amount, 6 - after[side][element]);
    after[side][element] += gain; gains[side][element] += gain; laneGains[side][lane] = gain; return gain;
  };
  for (let lane = 0; lane < 4; lane++) {
    if (!a[lane] || !b[lane]) continue;
    const left = totals[0][lane] + Number(beats[a[lane].element] === b[lane].element) * 2;
    const right = totals[1][lane] + Number(beats[b[lane].element] === a[lane].element) * 2;
    if (left !== right) { const side = Number(right > left); wins[side]++; award(side, lane, 2); }
  }
  for (let side = 0; side < 2; side++) {
    let used = 0;
    for (let lane = 0; lane < 4 && used < wins[side]; lane++) {
      const value = formations[side][lane];
      if (!value || formations[1 - side][lane] || after[side][value.element] === 6) continue;
      used++; extra[side][lane] = award(side, lane, 1);
    }
  }
  const complete = after.map(value => elements.every(element => value[element] === 6));
  return { after, gains, laneGains, extra, wins, winner: complete[0] && complete[1] ? "draw" : complete[0] ? "player" : complete[1] ? "ai" : null };
}

test("WIP accepts all 15 physical occupancy patterns and rejects empty or oversized formations", () => {
  for (let mask = 1; mask < 16; mask++) {
    const formation = Array.from({ length: 4 }, (_, lane) => mask & 1 << lane ? card("gust", 5, "none", `lane-${lane}`) : null);
    const normalized = rules.normalizeFormation(formation);
    assert.deepEqual(normalized, formation); assert.equal(rules.getFormationMask(formation), mask);
    assert.equal(rules.countFormationCards(formation), occupied(formation).length);
    assert.doesNotThrow(() => rules.resolveProgress(formation, slots(card())));
  }
  assert.deepEqual(rules.normalizeFormation([card()]), slots(card()));
  for (const invalid of [[], [null, null, null, null], Array(5).fill(card()), null])
    assert.throws(() => rules.resolveProgress(invalid, slots(card())), RangeError);
});

test("free placement provides 1,960 distinct legal assignments from a seven-card hand", () => {
  const hand = Array.from({ length: 7 }, (_, index) => card(elements[index % 3], index + 3, "none", `hand-${index}`));
  const all = rules.enumerateFormations(hand);
  assert.equal(all.length, 1960);
  assert.equal(new Set(all.map(formation => formation.map(value => value?.instanceId || "-").join(","))).size, 1960);
  assert.equal(new Set(all.map(rules.getFormationMask)).size, 15);
  for (const formation of all) {
    const cards = occupied(formation); assert.equal(formation.length, 4);
    assert.equal(new Set(cards).size, cards.length); assert.ok(cards.every(value => hand.includes(value)));
  }
});

test("a lone card can occupy Lane 2 or Lane 4 without being moved into Lane 1", () => {
  const a = slots(null, card("gust", 9)), b = slots(null, card("gust", 3));
  const result = rules.resolveProgress(a, b);
  assert.deepEqual(result.results, ["empty", "player", "empty", "empty"]);
  assert.deepEqual(result.laneProgress.player, [0, 2, 0, 0]);
  assert.equal(result.commitments.player, 1);
  const fourth = rules.resolveProgress(slots(null, null, null, card("tide", 9)), slots(null, null, null, card("tide", 3)));
  assert.deepEqual(fourth.laneProgress.player, [0, 0, 0, 2]);
});

test("no-clash, loss-only and draw-only formations cannot farm unopposed trophies", () => {
  const a = slots(card("ember", 3), card("gust", 3)), b = slots(null, null, card("tide", 9), card("ember", 9));
  for (const result of [rules.resolveProgress(a, b),
    rules.resolveProgress(slots(card("ember", 3), card("gust", 3), card("tide", 3)), slots(card("ember", 9))),
    rules.resolveProgress(slots(card("ember", 5), card("gust", 3), card("tide", 3)), slots(card("ember", 5)))]) {
    assert.deepEqual(result.progressGains.player, progress());
    assert.deepEqual(result.extraCardLanePoints.player, [0, 0, 0, 0]);
  }
  assert.deepEqual(rules.resolveProgress(a, b).progressGains.ai, progress());
});

test("each contested victory unlocks exactly one unopposed trophy, not every empty lane", () => {
  const one = rules.resolveProgress(slots(card("ember", 9), card("gust", 3), card("tide", 3), card("gust", 4)), slots(card("ember", 3)));
  assert.deepEqual(one.progressGains.player, progress(2, 1));
  assert.deepEqual(one.extraCardLanePoints.player, [0, 1, 0, 0]);
  const two = rules.resolveProgress(slots(card("ember", 9), card("gust", 9), card("tide", 3), card("ember", 3)),
    slots(card("ember", 3), card("gust", 3)));
  assert.deepEqual(two.progressGains.player, progress(3, 2, 1));
  assert.deepEqual(two.extraCardLanePoints.player, [0, 0, 1, 1]);
});

test("split victories can fund each side independently, even when formation sizes match", () => {
  const result = rules.resolveProgress(slots(card("ember", 9), card("gust", 3), card("tide", 3)),
    slots(card("ember", 3), card("gust", 9), null, card("ember", 4)));
  assert.deepEqual(result.progressGains, { player: progress(2, 0, 1), ai: progress(1, 2) });
  assert.deepEqual(result.extraCardLanePoints, { player: [0, 0, 1, 0], ai: [0, 0, 0, 1] });
});

test("completed-element fighters still fund useful escorts and completed escorts do not consume unlocks", () => {
  const a = slots(card("ember", 9), card("gust", 3), card("tide", 3)), b = slots(card("ember", 3));
  const result = rules.resolveProgress(a, b, progress(6, 6, 5));
  assert.deepEqual(result.laneProgress.player, [0, 0, 1, 0]);
  assert.equal(result.matchWinner, "player");
  const dynamic = rules.resolveProgress(slots(card("ember", 9), card("gust", 9), card("tide", 3), card("tide", 4)),
    slots(card("ember", 3), card("gust", 3)), progress(0, 0, 5));
  assert.deepEqual(dynamic.laneProgress.player, [2, 2, 1, 0]);
});

test("roles use physical geometry: gaps break Link and Rally; Finisher is rightmost occupied, not array end", () => {
  const vanguard = card("ember", 5, "vanguard"), link = card("tide", 5, "link"), rally = card("gust", 4, "rally"), finisher = card("gust", 5, "finisher");
  assert.equal(rules.getTacticBonus(slots(null, vanguard), 1), 0);
  assert.equal(rules.getTacticBonus(slots(vanguard, null, link), 2), 0);
  assert.equal(rules.getTacticBonus(slots(null, vanguard, link), 2), 1);
  assert.equal(rules.getRallyBonus(slots(vanguard, null, rally), 0), 0);
  assert.equal(rules.getRallyBonus(slots(null, null, vanguard, rally), 2), 1);
  assert.equal(rules.getTacticBonus(slots(null, finisher), 1), 0);
  assert.equal(rules.getTacticBonus(slots(vanguard, null, finisher), 2), 1);
  assert.deepEqual([0, 1, 2, 3].map(lane => rules.getRallyBonus(slots(rally, rally, rally), lane)), [1, 1, 0, 0]);
});

test("both sides resolve every lane before deciding simultaneous match completion", () => {
  const result = rules.resolveProgress(slots(card("ember", 9), null, null, card("tide", 3)),
    slots(card("ember", 3), null, null, card("tide", 9)), progress(4, 6, 6), progress(6, 6, 4));
  assert.equal(result.matchWinner, "draw");
  assert.deepEqual(result.progressAfter, { player: progress(6, 6, 6), ai: progress(6, 6, 6) });
});

test("all 1,265 legal abstract lane-result patterns match the oracle at empty and nearly complete goals", () => {
  const goalStates = [progress(), progress(6, 6, 5), progress(5, 5, 5), progress(6, 0, 6)];
  let patterns = 0, comparisons = 0;
  // Each physical lane is both empty, only player, only opponent, draw,
  // player victory, or opponent victory. Reject a completely empty side.
  for (let variant = 0; variant < 6 ** 4; variant++) {
    let remaining = variant;
    const a = Array(4).fill(null), b = Array(4).fill(null);
    for (let lane = 0; lane < 4; lane++) {
      const outcome = remaining % 6; remaining = Math.floor(remaining / 6);
      if ([1, 3, 4, 5].includes(outcome)) a[lane] = card(elements[lane % 3], outcome === 4 ? 9 : 5);
      if ([2, 3, 4, 5].includes(outcome)) b[lane] = card(elements[lane % 3], outcome === 5 ? 9 : 5);
    }
    if (!occupied(a).length || !occupied(b).length) continue;
    patterns++;
    goalStates.forEach((pa, index) => {
      const pb = goalStates[(index + 1) % goalStates.length], expected = oracle(a, b, pa, pb);
      const actual = rules.resolveProgress(a, b, pa, pb);
      assert.deepEqual(actual.progressGains, { player: expected.gains[0], ai: expected.gains[1] });
      assert.deepEqual(actual.extraCardLanePoints, { player: expected.extra[0], ai: expected.extra[1] });
      assert.equal(actual.matchWinner, expected.winner);
      comparisons++;
    });
  }
  assert.equal(patterns, 1265);
  assert.equal(comparisons, 5060);
});

test("25,000 sparse formations match an independent oracle with symmetry, clipping and no input mutations", () => {
  let seed = 719384, checks = 0;
  const roll = n => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % n;
  const make = () => {
    const mask = 1 + roll(15);
    return Array.from({ length: 4 }, (_, lane) => mask & 1 << lane ? card(elements[roll(3)], 3 + roll(7), ["vanguard", "link", "finisher", "rally"][roll(4)], `card-${lane}`) : null);
  };
  for (let sample = 0; sample < 25000; sample++) {
    const a = make(), b = make(), pa = progress(roll(7), roll(7), roll(7)), pb = progress(roll(7), roll(7), roll(7));
    const before = JSON.stringify({ a, b, pa, pb }), expected = oracle(a, b, pa, pb), actual = rules.resolveProgress(a, b, pa, pb);
    assert.deepEqual(actual.progressAfter, { player: expected.after[0], ai: expected.after[1] });
    assert.deepEqual(actual.progressGains, { player: expected.gains[0], ai: expected.gains[1] });
    assert.deepEqual(actual.laneProgress, { player: expected.laneGains[0], ai: expected.laneGains[1] });
    assert.deepEqual(actual.extraCardLanePoints, { player: expected.extra[0], ai: expected.extra[1] });
    assert.equal(actual.matchWinner, expected.winner);
    const reverse = rules.resolveProgress(b, a, pb, pa);
    assert.deepEqual(reverse.progressGains.player, actual.progressGains.ai);
    assert.deepEqual(reverse.progressGains.ai, actual.progressGains.player);
    assert.ok(actual.extraCardPoints.player <= actual.laneWins.player && actual.extraCardPoints.ai <= actual.laneWins.ai);
    assert.equal(JSON.stringify({ a, b, pa, pb }), before); checks++;
  }
  assert.equal(checks, 25000);
});

test("draw-three supports sustainable three-card turns while four-card pushes spend reserves", () => {
  assert.equal(rules.ROUND_DRAW, 3);
  const hand = Array.from({ length: 7 }, (_, index) => card("gust", 5, "none", `hand-${index}`));
  const deck = Array.from({ length: 40 }, (_, index) => card("gust", 5, "none", `deck-${index}`));
  for (let round = 0; round < 5; round++) { hand.splice(0, 3); assert.equal(rules.replenishHand(deck, [], hand).drawn, 3); assert.equal(hand.length, 7); }
  for (const expected of [6, 5, 4, 3]) { hand.splice(0, 4); rules.replenishHand(deck, [], hand); assert.equal(hand.length, expected); }
  hand.splice(0, 1); rules.replenishHand(deck, [], hand); assert.equal(hand.length, 5);
  assert.equal(normal.MAX_COMMITMENT, 3); assert.equal(normal.LANE_WIN_POINTS, 2);
});
