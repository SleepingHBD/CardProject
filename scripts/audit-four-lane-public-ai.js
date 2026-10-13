// Live public-hand/shared-lane match QA. This is a reproducible smoke and
// strategy benchmark, not a proof of human balance or eight-round optimal play.
// Usage: node scripts/audit-four-lane-public-ai.js [starter-seeds=2] [seed=54871]
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { catalog, createAuditDecks, rng } from "./audit-deckbuilding.js";
import "../src/four-lane-ai.js";

const normal = globalThis.ClawRules, rules = globalThis.ClawFourLaneRules;
const decks = globalThis.ClawDeckbuilding, ai = globalThis.ClawFourLaneAi;

export function playPublicMatch(left, right, seed) {
  const sides = [left, right].map((definition, index) => {
    const random = rng(seed + index * 8191), deck = [];
    normal.reshuffleDiscardPile(deck, decks.buildDeckInstances(catalog, definition, index ? "opponent" : "player"), random);
    const side = { deck, hand: [], discard: [], progress: rules.createProgress(), random,
      decisions: rng(seed + 71001 + index * 10009) };
    rules.replenishHand(deck, side.discard, side.hand, rules.HAND_SIZE, random);
    return side;
  });
  const counts = [0, 0, 0, 0], timings = [];
  let dry = 0, roleBonuses = 0, battles = 0, extras = 0;
  let final;
  for (let round = 1; round <= rules.MAX_MATCH_ROUNDS; round++) {
    const snapshot = sides.map(side => JSON.stringify([side.hand, side.progress]));
    // Both choose from the same public state BEFORE either plays. No actual
    // opposing chosen plan is provided to the planner in either seat.
    const plans = sides.map((side, index) => {
      const begin = performance.now();
      const plan = ai.chooseFormation(side.hand, sides[1 - index].hand,
        side.progress, sides[1 - index].progress, round, side.decisions);
      timings.push(performance.now() - begin);
      assert.ok(rules.isValidBattleFormation(plan, round));
      assert.ok(plan.filter(Boolean).every(card => side.hand.includes(card)));
      return plan;
    });
    sides.forEach((side, index) => assert.equal(JSON.stringify([side.hand, side.progress]), snapshot[index]));
    final = rules.resolveProgress(plans[0], plans[1], sides[0].progress, sides[1].progress, undefined, round);
    assert.ok(round === rules.MAX_MATCH_ROUNDS ? final.matchWinner : final.matchWinner === null);
    dry += Number(final.score.player === 0 && final.score.ai === 0);
    battles += final.laneWins.player + final.laneWins.ai + final.laneWins.draw;
    extras += final.extraCardPoints.player + final.extraCardPoints.ai;
    sides.forEach((side, index) => {
      const played = plans[index].filter(Boolean);
      counts[played.length - 1]++;
      plans[index].forEach((card, lane) => {
        if (card) roleBonuses += rules.getTacticBonus(plans[index], lane) + rules.getRallyBonus(plans[index], lane);
      });
      side.hand = side.hand.filter(card => !played.includes(card));
      side.discard.push(...played);
      side.progress = final.progressAfter[index ? "ai" : "player"];
      const owned = [...side.hand, ...side.deck, ...side.discard];
      assert.equal(owned.length, decks.DECK_SIZE);
      assert.equal(new Set(owned).size, decks.DECK_SIZE);
      assert.equal(new Set(owned.map(card => card.instanceId)).size, decks.DECK_SIZE);
      assert.ok(owned.every(card => card.instanceId.startsWith(index ? "opponent-" : "player-")));
      assert.ok(final.extraCardPoints[index ? "ai" : "player"] <= rules.MAX_EXTRA_CARD_POINTS);
      if (round < rules.MAX_MATCH_ROUNDS) {
        const result = rules.replenishHand(side.deck, side.discard, side.hand, rules.ROUND_DRAW, side.random);
        assert.ok(result.drawn <= rules.ROUND_DRAW && side.hand.length >= 1 && side.hand.length <= rules.HAND_SIZE);
      }
    });
  }
  return { winner: final.matchWinner, matchScores: sides.map(side => rules.getMatchScore(side.progress)),
    counts, dry, battles, extras, roleBonuses, timings, rounds: rules.MAX_MATCH_ROUNDS };
}

export async function auditPublicAi({ trials = 2, seed = 54871, progress = () => {} } = {}) {
  assert.ok(Number.isInteger(trials) && trials >= 1 && trials <= 100);
  assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff);
  const starters = decks.createStarterPresets(catalog), diagnostic = createAuditDecks(seed);
  const definitions = [];
  starters.forEach((left, leftIndex) => starters.forEach((right, rightIndex) => {
    for (let trial = 0; trial < trials; trial++) definitions.push({ left, right,
      seed: seed + Math.min(leftIndex, rightIndex) * 100003 + Math.max(leftIndex, rightIndex) * 1009 + trial * 101 });
  }));
  diagnostic.forEach((left, index) => [starters[0], starters[2]].forEach((right, seat) => {
    definitions.push({ left, right, seed: seed + index * 1019 + seat * 7001 });
  }));
  const started = performance.now(), counts = [0, 0, 0, 0], timings = [], matches = [];
  let dry = 0, rounds = 0, battles = 0, extras = 0, roleBonuses = 0, draws = 0;
  for (const definition of definitions) {
    const result = playPublicMatch(definition.left, definition.right, definition.seed >>> 0);
    rounds += result.rounds; dry += result.dry; battles += result.battles;
    extras += result.extras; roleBonuses += result.roleBonuses; draws += Number(result.winner === "draw");
    result.counts.forEach((value, index) => { counts[index] += value; });
    timings.push(...result.timings);
    matches.push({ left: definition.left.id, right: definition.right.id, seed: definition.seed >>> 0,
      winner: result.winner, matchScores: result.matchScores, counts: result.counts, dryRounds: result.dry });
    if (matches.length % 8 === 0) {
      progress(`${matches.length}/${definitions.length} public-hand matches`);
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  timings.sort((a, b) => a - b);
  return { trials, seed, matches: matches.length, rounds, draws, dryRounds: dry,
    dryRoundPercent: +(100 * dry / rounds).toFixed(2), counts, battles, extras, roleBonuses,
    timingMs: { median: +timings[Math.floor(timings.length * .5)].toFixed(2),
      p95: +timings[Math.floor(timings.length * .95)].toFixed(2), maximum: +timings.at(-1).toFixed(2) },
    durationMs: Math.round(performance.now() - started), results: matches };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await auditPublicAi({ trials: Number(process.argv[2] || 2),
    seed: Number(process.argv[3] || 54871), progress: message => console.error(message) }), null, 2));
}
