// Paired starter comparison using the live elemental-progress planner on both sides.
// Usage: node scripts/audit-four-lane-ai.js [paired-seeds=32] [seed=48103]
// This is a reproducible strategy benchmark, not a proof of human-play balance.
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { catalog, library, rng } from "./audit-deckbuilding.js";

const normal = globalThis.ClawRules, rules = globalThis.ClawFourLaneRules;
const decks = globalThis.ClawDeckbuilding;
const starters = decks.createStarterPresets(catalog);

export function compareStarters(left, right, seed, maxRounds = 150) {
  const sides = [left, right].map((definition, side) => {
    const random = rng(seed + side * 8191), deck = [];
    normal.reshuffleDiscardPile(deck, decks.buildDeckInstances(catalog, definition, side ? "opponent" : "player"), random);
    const value = { deck, discard: [], hand: [], progress: rules.createProgress(), random, decisions: rng(seed + 31001 + side * 10000) };
    rules.replenishHand(deck, value.discard, value.hand, 7, random);
    return value;
  });
  const history = [], counts = [[0, 0, 0, 0], [0, 0, 0, 0]];
  let reshuffles = 0;
  for (let round = 1; round <= maxRounds; round++) {
    const reversed = history.map(value => ({ playerCards: value.aiCards, aiCards: value.playerCards,
      laneProgress: { player: value.laneProgress.ai, ai: value.laneProgress.player } }));
    // Both planners read only their own hand and public information.
    const plays = sides.map((side, index) => rules.chooseAiFormation(side.hand, sides[1 - index].progress, side.progress,
      side.decisions, [], { history: index ? history : reversed, cardLibrary: library }));
    const result = rules.resolveProgress(...plays, sides[0].progress, sides[1].progress);
    sides.forEach((side, index) => {
      const cards = plays[index];
      assert.ok(cards.length >= 1 && cards.length <= 4 && new Set(cards).size === cards.length);
      assert.ok(cards.every(card => side.hand.includes(card)));
      counts[index][cards.length - 1]++;
      side.hand = side.hand.filter(card => !cards.includes(card));
      side.discard.push(...cards);
      side.progress = { ...result.progressAfter[index ? "ai" : "player"] };
      const all = [...side.hand, ...side.deck, ...side.discard];
      assert.equal(all.length, 24);
      assert.equal(new Set(all.map(card => card.instanceId)).size, 24);
      assert.ok(all.every(card => card.instanceId.startsWith(index ? "opponent-" : "player-")));
    });
    const snapshot = cards => cards.map(({ art, power, element, tactic }) => ({ art, power, element, tactic }));
    history.push({ playerCards: snapshot(plays[0]), aiCards: snapshot(plays[1]), laneProgress: result.laneProgress });
    if (result.matchWinner) return { winner: result.matchWinner, rounds: round, counts, reshuffles };
    sides.forEach(side => {
      const refill = rules.replenishHand(side.deck, side.discard, side.hand, 2, side.random);
      assert.ok(refill.drawn <= 2 && side.hand.length >= 1 && side.hand.length <= 7);
      reshuffles += Number(refill.reshuffled);
    });
  }
  return { winner: "stalled", rounds: maxRounds, counts, reshuffles };
}

export async function auditStarters({ trials = 32, seed = 48103, progress = () => {} } = {}) {
  assert.ok(Number.isInteger(trials) && trials >= 1 && trials <= 500);
  assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff);
  const started = performance.now(), cells = [], counts = [0, 0, 0, 0];
  const totals = Object.fromEntries(starters.map(deck => [deck.id, { matches: 0, wins: 0, draws: 0 }]));
  let matches = 0, stalls = 0, rounds = 0, longest = 0, reshuffles = 0;
  for (let left = 0; left < starters.length; left++) for (let right = 0; right < starters.length; right++) {
    const cell = { left: starters[left].id, right: starters[right].id, matches: 0, wins: 0, draws: 0 };
    for (let trial = 0; trial < trials; trial++) {
      // Same paired seed in both seats, independent shuffle/decision streams.
      const result = compareStarters(starters[left], starters[right], (seed + Math.min(left, right) * 100003
        + Math.max(left, right) * 1009 + trial * 101) >>> 0);
      matches++; cell.matches++; rounds += result.rounds; longest = Math.max(longest, result.rounds); reshuffles += result.reshuffles;
      stalls += Number(result.winner === "stalled");
      cell.wins += Number(result.winner === "player"); cell.draws += Number(result.winner === "draw");
      for (const [index, starter] of [[0, starters[left]], [1, starters[right]]]) {
        const total = totals[starter.id]; total.matches++;
        total.wins += Number(result.winner === (index ? "ai" : "player")); total.draws += Number(result.winner === "draw");
        counts.forEach((_, count) => { counts[count] += result.counts[index][count]; });
      }
      if (matches % 64 === 0) { progress(matches + "/" + starters.length ** 2 * trials + " paired starter duels"); await new Promise(resolve => setImmediate(resolve)); }
    }
    cells.push({ ...cell, matchScorePercent: +((cell.wins + cell.draws * .5) / cell.matches * 100).toFixed(1) });
  }
  return { seed, trials, matches, stalls, avgRounds: +(rounds / matches).toFixed(1), longest, reshuffles, counts,
    durationMs: Math.round(performance.now() - started),
    starters: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, { ...value,
      matchScorePercent: +((value.wins + value.draws * .5) / value.matches * 100).toFixed(1) }])), cells };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await auditStarters({ trials: Number(process.argv[2] || 32), seed: Number(process.argv[3] || 48103), progress: message => console.error(message) });
  console.log(JSON.stringify(report, null, 2));
  if (report.stalls) process.exitCode = 1;
}
