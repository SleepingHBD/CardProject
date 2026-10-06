// Reproducible, public-information-only strategy benchmark. Not a proof of balance.
// Usage: node scripts/audit-four-lane-ai.js solo-farm [baseline] [seeds-per-profile]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

const policy = process.argv[2] || "solo-farm";
const baseline = process.argv[3] === "baseline";
const trials = Number(process.argv[4] || 12);
const policies = ["one", "two", "three", "four", "cycle-3-1", "cycle-4-1-1", "cheap-second", "two-rally", "hoard-premiums", "habit-reader", "solo-farm", "history-counter"];
assert.ok(policies.includes(policy));
assert.ok(Number.isInteger(trials) && trials >= 1 && trials <= 100);
const context = {};
Function("globalThis", readFileSync(new URL("../src/rules.js", import.meta.url), "utf8"))(context);
// The retained commitment-then-greedy helpers provide the old-AI control group
// under the current scoring rules (including the extra-card cap).
const fourSource = readFileSync(new URL("../src/four-lane-rules.js", import.meta.url), "utf8");
Function("globalThis", fourSource)(context);
const n = context.ClawRules, r = context.ClawFourLaneRules;
const game = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const library = Function(game.slice(game.indexOf("const CARD_LIBRARY ="), game.indexOf("const HAND_SIZE ="))
  + game.slice(game.indexOf("const FOUR_LANE_RALLY_CARDS ="), game.indexOf("const DIFFICULTIES ="))
  + ";return [...CARD_LIBRARY,...FOUR_LANE_CARDS];")();
const elements = Object.keys(n.ELEMENTS);
const rng = seed => { let x = seed >>> 0; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32); };
const permutations = cards => cards.length < 2 ? [[...cards]] : cards.flatMap((card, index) =>
  permutations(cards.filter((_, other) => index !== other)).map(rest => [card, ...rest]));
function order(cards) {
  return permutations(cards).map(formation => ({ formation,
    score: formation.reduce((sum, card, i) => sum + (r.getTacticBonus(formation, i) + r.getRallyBonus(formation, i)) * 4, 0)
      + formation.at(-1).power * .02 })).sort((a, b) => b.score - a.score)[0].formation;
}
function select(side, round, counts, traits) {
  const { hand, trophies } = side, needs = n.getElementTrophyCounts(trophies);
  const ordered = [...hand].sort((a, b) => (b.power + (needs[b.element] < 2 ? .7 : 0) + (b.tactic === "vanguard" ? .25 : 0))
    - (a.power + (needs[a.element] < 2 ? .7 : 0) + (a.tactic === "vanguard" ? .25 : 0)));
  let count = policies.indexOf(policy) + 1, prediction = 2;
  if (policy === "cycle-3-1") count = [3, 1][round % 2];
  if (policy === "cycle-4-1-1") count = [4, 1, 1][round % 3];
  if (["cheap-second", "two-rally", "hoard-premiums"].includes(policy)) count = 2;
  if (policy === "habit-reader") {
    const ids = traits.map(trait => trait.id), recent = counts.slice(-4);
    const mean = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 2.5;
    prediction = ids.includes("solo-gambler") ? 1 : ids.includes("measured-planner") ? 2 : ids.includes("full-formation") ? 4 : Math.round(mean);
    count = hand.length <= 3 ? 1 : prediction === 1 && hand.length >= 6 ? 4 : hand.length >= 5 ? 3 : 2;
  }
  if (policy === "solo-farm") count = hand.length >= 6 ? 4 : 1;
  if (policy === "history-counter") {
    for (let period = 3; period >= 1; period--) if (counts.length >= period * 2) {
      const tail = counts.slice(-period * 2);
      if (tail.slice(0, period).every((value, i) => value === tail[i + period])) { prediction = tail[0]; break; }
    }
    count = prediction === 1 && hand.length >= 6 ? 4 : 2;
  }
  count = Math.min(Math.max(count, 1), 4, hand.length);
  if (policy === "solo-farm" && count === 4) {
    const cheap = [...hand].sort((a, b) => a.power - b.power), first = cheap[0];
    const trophy = cheap.find(card => card !== first && needs[card.element] < 2) || cheap[1];
    return [first, trophy, ...cheap.filter(card => card !== first && card !== trophy).slice(0, 2)];
  }
  if (["cheap-second", "two-rally", "history-counter"].includes(policy) && count === 2) {
    let best, score = -Infinity;
    for (const first of hand) for (const second of hand) if (first !== second) {
      const pair = [first, second], totals = pair.map((card, i) => card.power + r.getTacticBonus(pair, i) + r.getRallyBonus(pair, i));
      const value = policy === "cheap-second" ? totals[0] - second.power * .15 + (needs[first.element] < 2 ? .25 : 0)
        : policy === "history-counter" ? (prediction === 1 ? totals[0] - second.power * .15 : Math.min(...totals) * 3 + totals[0] + totals[1])
          : totals[0] + totals[1] + first.power * .05;
      if (value > score) { best = pair; score = value; }
    }
    return best;
  }
  return order((policy === "hoard-premiums" && hand.length >= 4 ? ordered.slice(2) : ordered).slice(0, count));
}
function setup(seed) {
  return [0, 1].map(owner => {
    const deck = [], random = rng(seed + owner * 1000003);
    n.reshuffleDiscardPile(deck, library.map((card, i) => ({ ...card, instanceId: owner + "-" + i })), random);
    const side = { deck, hand: [], discard: [], trophies: [], random };
    r.replenishHand(deck, side.discard, side.hand, r.HAND_SIZE, random);
    return side;
  });
}
const totals = { policy, baseline, matches: 0, wins: 0, rounds: 0, reshuffles: 0, longest: 0,
  aiCounts: [0, 0, 0, 0], byCommitment: {}, planningCalls: 0, planningMs: 0, maxPlanningMs: 0 };
const started = performance.now();
function duel(seed, traits) {
  const sides = setup(seed), decisionRng = rng(seed + 4000007), history = [], previous = {}, counts = [];
  for (let round = 0; round < 150; round++) {
    if (performance.now() - started > 52000) throw Error("52-second benchmark deadline; use fewer seeds per profile");
    const begin = performance.now();
    const ai = baseline ? r.chooseAiCards(sides[1].hand, r.chooseAiCommitment(sides[1].hand.length,
      sides[0].trophies, sides[1].trophies, decisionRng, traits, previous), sides[0].trophies, sides[1].trophies, decisionRng, traits)
      : r.chooseAiFormation(sides[1].hand, sides[0].trophies, sides[1].trophies, decisionRng, traits,
        { history, cardLibrary: library });
    const elapsed = performance.now() - begin;
    totals.planningCalls++; totals.planningMs += elapsed; totals.maxPlanningMs = Math.max(totals.maxPlanningMs, elapsed);
    const cards = [select(sides[0], round, counts, traits), ai];
    totals.aiCounts[ai.length - 1]++;
    totals.byCommitment[traits.at(-1).id].aiCounts[ai.length - 1]++;
    const result = r.resolveClashes(...cards), winner = result.winner === "draw" ? -1 : result.winner === "player" ? 0 : 1;
    const options = r.getFormationRewardOptions(...cards, result);
    const reward = options.length ? n.chooseTrophyReward(options, sides[winner].trophies) : null;
    sides.forEach((side, i) => {
      assert.ok(cards[i].length >= 1 && cards[i].length <= 4 && new Set(cards[i]).size === cards[i].length);
      assert.ok(cards[i].every(card => side.hand.includes(card)));
      side.hand = side.hand.filter(card => !cards[i].includes(card));
      side.discard.push(...cards[i].filter(card => card !== reward?.card));
      if (reward && i === winner) side.trophies.push(reward.card);
      const all = [...side.hand, ...side.deck, ...side.discard, ...side.trophies];
      assert.equal(all.length, 36); assert.equal(new Set(all.map(card => card.instanceId)).size, 36);
      assert.ok(all.every(card => card.instanceId.startsWith(i + "-")));
    });
    history.push({ playerCards: cards[0].map(({ element, power, tactic }) => ({ element, power, tactic })),
      aiCards: cards[1].map(({ element, power, tactic }) => ({ element, power, tactic })) });
    counts.push(ai.length); previous.player = cards[0].length; previous.ai = ai.length;
    const completed = sides.findIndex(side => n.hasCompletedElementSet(side.trophies));
    if (completed >= 0) { totals.rounds += round + 1; totals.longest = Math.max(totals.longest, round + 1); return completed; }
    sides.forEach(side => { totals.reshuffles += Number(r.replenishHand(side.deck, side.discard, side.hand, r.ROUND_DRAW, side.random).reshuffled); });
  }
  throw Error("Match stalled");
}
let profile = 0;
for (const motive of n.AI_MOTIVE_TRAITS) for (const formation of n.AI_FORMATION_TRAITS) for (const commitment of n.AI_COMMITMENT_TRAITS) {
  const group = totals.byCommitment[commitment.id] ||= { wins: 0, matches: 0, aiCounts: [0, 0, 0, 0] };
  for (let trial = 0; trial < trials; trial++) {
    const traits = [motive.id === "element-loyalist" ? { ...motive, element: elements[trial % 3] } : motive, formation, commitment];
    const won = Number(duel(100000 + profile * 100 + trial, traits) === 0);
    totals.matches++; totals.wins += won; group.matches++; group.wins += won;
  }
  profile++;
}
totals.winPercent = +(totals.wins / totals.matches * 100).toFixed(1);
totals.avgRounds = +(totals.rounds / totals.matches).toFixed(1);
totals.avgPlanningMs = +(totals.planningMs / totals.planningCalls).toFixed(3);
totals.durationMs = Math.round(performance.now() - started);
console.log(JSON.stringify(totals));
