// Paired public-information strategy probes, not proof of universal balance.
// Usage: node scripts/audit-placement-habits.js [paired-trials=1] [seed=746381]
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { catalog, library, rng } from "./audit-deckbuilding.js";

const normal = globalThis.ClawRules, four = globalThis.ClawFourLaneRules;
const decks = globalThis.ClawDeckbuilding, keys = Object.keys(four.ELEMENTS);
const starters = decks.createStarterPresets(catalog);
const preferredMasks = [3, 12, 6, 9];
export const placementPolicies = Object.freeze([
  "lane-1", "lane-2", "lane-3", "lane-4", "left-pair", "right-pair", "centre-pair", "outer-pair", "rotating-pair",
  "left-three", "right-three", "outer-left-three", "outer-right-three", "rotating-three", "full-push", "adaptive",
]);
export const prepareFormation = cards => ({ cards, count: cards.filter(Boolean).length,
  elements: cards.map(card => card ? keys.indexOf(card.element) : -1),
  totals: cards.map((card, lane) => card ? card.power + four.getTacticBonus(cards, lane) + four.getRallyBonus(cards, lane) : 0) });

// Independent numeric scoring for the audit's hot loop. Automated tests compare
// this against the public resolver, including clipping and escort allocation.
export function placementUtility(plan, forecast, own, other) {
  const after = [...own], opposingAfter = [...other];
  let wins = 0, opposingWins = 0;
  for (let lane = 0; lane < 4; lane++) {
    const element = plan.elements[lane], opposing = forecast.elements[lane];
    if (element < 0 || opposing < 0) continue;
    const edge = (four.ELEMENTS[keys[element]].beats === keys[opposing] ? 2 : 0)
      - (four.ELEMENTS[keys[opposing]].beats === keys[element] ? 2 : 0);
    const margin = plan.totals[lane] - forecast.totals[lane] + edge;
    if (margin > 0) { wins++; after[element] = Math.min(6, after[element] + 2); }
    else if (margin < 0) { opposingWins++; opposingAfter[opposing] = Math.min(6, opposingAfter[opposing] + 2); }
  }
  for (let lane = 0; lane < 4; lane++) {
    const element = plan.elements[lane], opposing = forecast.elements[lane];
    if (wins && element >= 0 && opposing < 0 && after[element] < 6) { after[element]++; wins--; }
    if (opposingWins && opposing >= 0 && element < 0 && opposingAfter[opposing] < 6) { opposingAfter[opposing]++; opposingWins--; }
  }
  let value = 0;
  for (let element = 0; element < 3; element++) {
    value += (after[element] - own[element]) * (1 + (Math.max(...own) - own[element]) * .07)
      + Number(own[element] < 6 && after[element] === 6);
    value -= ((opposingAfter[element] - other[element]) * (1 + (Math.max(...other) - other[element]) * .07)
      + Number(other[element] < 6 && opposingAfter[element] === 6)) * .8;
  }
  const complete = after.every(value => value === 6), opposingComplete = opposingAfter.every(value => value === 6);
  return value + (complete && !opposingComplete ? 15 : opposingComplete && !complete ? -15 : 0);
}

export function allowsPlacementPolicy(cards, policy, round) {
  const mask = four.getFormationMask(cards);
  const single = /^lane-([1-4])$/.exec(policy);
  if (single) return mask === 1 << (Number(single[1]) - 1);
  const pair = { "left-pair": 3, "right-pair": 12, "centre-pair": 6, "outer-pair": 9 }[policy]
    ?? (policy === "rotating-pair" ? preferredMasks[round % 4] : null);
  if (pair !== null) return (mask & ~pair) === 0;
  const triple = { "left-three": 7, "right-three": 14, "outer-left-three": 11, "outer-right-three": 13 }[policy]
    ?? (policy === "rotating-three" ? [7, 14, 11, 13][round % 4] : null);
  if (triple !== null) return (mask & ~triple) === 0;
  if (policy === "full-push") return true;
  assert.equal(policy, "adaptive", "Unknown placement audit policy");
  return true;
}

export function publicPlacementForecasts(history, placement, random) {
  // Reverse perspective using completed rounds only. The current enemy hand,
  // plan, deck order and internal anchoring roll are not arguments to this API.
  const completed = history.map(entry => ({ playerCards: entry.aiCards, aiCards: entry.playerCards,
    laneProgress: { player: entry.laneProgress?.ai, ai: entry.laneProgress?.player } }));
  const read = four.readPlayerHistory(completed);
  const scenarios = four.buildPlayerScenarios(read, library, random);
  const mass = Array(5).fill(0), preferredMass = Array(5).fill(0);
  scenarios.forEach(scenario => {
    mass[scenario.count] += scenario.weight;
    if (four.isPreferredPlacement(scenario.cards, placement)) preferredMass[scenario.count] += scenario.weight;
  });
  return scenarios.map(scenario => ({ ...prepareFormation(scenario.cards),
    weight: preferredMass[scenario.count] ? (1 - four.PLACEMENT_HABIT_RATE) * scenario.weight
      + (four.isPreferredPlacement(scenario.cards, placement)
        ? four.PLACEMENT_HABIT_RATE * mass[scenario.count] * scenario.weight / preferredMass[scenario.count] : 0)
      : scenario.weight }));
}

export function choosePlacementProbe(hand, ownProgress, otherProgress, policy, round, history, placement, random) {
  const forecasts = publicPlacementForecasts(history, placement, random);
  const own = keys.map(key => ownProgress[key] || 0), other = keys.map(key => otherProgress[key] || 0);
  let best, bestValue = -Infinity;
  for (const cards of four.enumerateFormations(hand)) {
    if (!allowsPlacementPolicy(cards, policy, round)) continue;
    const plan = prepareFormation(cards);
    if (policy === "full-push" && plan.count !== Math.min(hand.length, 4)) continue;
    let value = -[0, 3.1, 1.8, .85, .3, .08, 0, 0][Math.min(7, hand.length - plan.count + 3)] - plan.count * .035;
    for (const forecast of forecasts) value += forecast.weight * placementUtility(plan, forecast, own, other);
    if (value > bestValue) { bestValue = value; best = cards; }
  }
  assert.ok(best, "Every policy has a legal plan whenever the hand is nonempty");
  return best;
}

export function simulatePlacementMatch(starterIndex, placementIndex, policy, seed) {
  const placement = four.AI_PLACEMENT_TRAITS[placementIndex];
  const pools = { motive: ["power-seeker"], placement: [placement.id],
    commitment: [["measured-planner", "full-formation", "restless-dealer", "score-reader"][placementIndex]] };
  const traits = four.createAiTraits(() => .4, pools), stable = JSON.stringify(traits);
  const sides = [starters[starterIndex], starters[(starterIndex + placementIndex) % starters.length]].map((definition, owner) => {
    const random = rng(seed + owner * 8191), deck = [], discard = decks.buildDeckInstances(catalog, definition, owner ? "opponent" : "player");
    normal.reshuffleDiscardPile(deck, discard, random);
    const side = { deck, discard, hand: [], progress: four.createProgress(), random };
    four.replenishHand(deck, discard, side.hand, 7, random);
    return side;
  });
  const history = [], decisions = [rng(seed + 31001), rng(seed + 41001)];
  const result = { winner: "draw", roundLimitDraw: false, rounds: 0, playerCards: 0, playerTrophies: 0,
    playerCounts: [0, 0, 0, 0],
    opponentCounts: [0, 0, 0, 0], preferredByCount: [0, 0, 0], totalByCount: [0, 0, 0], maxPlanningMs: 0 };
  for (let round = 0; round < four.MAX_MATCH_ROUNDS; round++) {
    const ai = four.chooseAiFormation(sides[1].hand, sides[0].progress, sides[1].progress, decisions[1], traits,
      { history, cardLibrary: library }, [null, "rally", "link", "finisher"][(starterIndex + placementIndex) % 4]);
    const start = performance.now();
    const player = choosePlacementProbe(sides[0].hand, sides[0].progress, sides[1].progress,
      policy, round, history, placement, decisions[0]);
    result.maxPlanningMs = Math.max(result.maxPlanningMs, performance.now() - start);
    const plays = [player, ai], resolved = four.resolveProgress(player, ai, sides[0].progress, sides[1].progress);
    result.rounds++; result.playerCards += player.filter(Boolean).length;
    result.playerCounts[player.filter(Boolean).length - 1]++;
    result.playerTrophies += resolved.score.player;
    const count = ai.filter(Boolean).length;
    result.opponentCounts[count - 1]++;
    if (count < 4) {
      result.totalByCount[count - 1]++;
      result.preferredByCount[count - 1] += Number(four.isPreferredPlacement(ai, placement));
    }
    sides.forEach((side, owner) => {
      const cards = plays[owner].filter(Boolean);
      assert.ok(cards.length >= 1 && cards.length <= 4 && new Set(cards).size === cards.length);
      assert.ok(cards.every(card => side.hand.includes(card)));
      side.hand = side.hand.filter(card => !plays[owner].includes(card));
      side.discard.push(...cards);
      side.progress = { ...resolved.progressAfter[owner ? "ai" : "player"] };
      const all = [...side.deck, ...side.discard, ...side.hand];
      assert.equal(all.length, 24);
      assert.equal(new Set(all.map(card => card.instanceId)).size, 24);
    });
    const snapshot = cards => cards.map(card => card ? { art: card.art, power: card.power, element: card.element, tactic: card.tactic } : null);
    history.push({ playerCards: snapshot(player), aiCards: snapshot(ai), laneProgress: resolved.laneProgress });
    if (resolved.matchWinner) { result.winner = resolved.matchWinner === "ai" ? "opponent" : resolved.matchWinner; break; }
    if (result.rounds === four.MAX_MATCH_ROUNDS) { result.roundLimitDraw = true; break; }
    sides.forEach(side => {
      const before = side.hand.length;
      const refill = four.replenishHand(side.deck, side.discard, side.hand, 3, side.random);
      assert.equal(side.hand.length - before, refill.drawn);
      assert.ok(refill.drawn <= 3 && side.hand.length >= 1 && side.hand.length <= 7);
    });
  }
  assert.equal(JSON.stringify(traits), stable);
  return result;
}

export function runPlacementAudit(trials = 1, seed = 746381) {
  assert.ok(Number.isSafeInteger(trials) && trials >= 1 && trials <= 8);
  const start = performance.now(), groups = Object.fromEntries(placementPolicies.map(policy => [policy,
    { matches: 0, wins: 0, draws: 0, capDraws: 0, rounds: 0, longest: 0, cards: 0, trophies: 0, counts: [0, 0, 0, 0] }]));
  const consistency = four.AI_PLACEMENT_TRAITS.map(trait => ({ id: trait.id, preferred: [0, 0, 0], partial: [0, 0, 0], full: 0 }));
  const paired = [], planningMs = [];
  for (let trial = 0; trial < trials; trial++) for (let starter = 0; starter < 4; starter++) for (let placement = 0; placement < 4; placement++) {
    const results = {};
    const matchSeed = seed + trial * 100003 + starter * 8191 + placement * 7919;
    for (const policy of placementPolicies) {
      const result = simulatePlacementMatch(starter, placement, policy, matchSeed);
      results[policy] = Number(result.winner === "player") + .5 * Number(result.winner === "draw");
      const group = groups[policy];
      group.matches++; group.wins += Number(result.winner === "player"); group.draws += Number(result.winner === "draw");
      group.capDraws += Number(result.roundLimitDraw); group.rounds += result.rounds; group.longest = Math.max(group.longest, result.rounds);
      group.cards += result.playerCards; group.trophies += result.playerTrophies;
      result.playerCounts.forEach((count, index) => { group.counts[index] += count; });
      for (let count = 0; count < 3; count++) {
        consistency[placement].preferred[count] += result.preferredByCount[count];
        consistency[placement].partial[count] += result.totalByCount[count];
      }
      consistency[placement].full += result.opponentCounts[3];
      planningMs.push(result.maxPlanningMs);
    }
    paired.push(results);
  }
  const metrics = Object.fromEntries(Object.entries(groups).map(([policy, group]) => [policy, {
    matches: group.matches, wins: group.wins, draws: group.draws, capDraws: group.capDraws,
    scorePct: +(100 * (group.wins + group.draws * .5) / group.matches).toFixed(1),
    meanRounds: +(group.rounds / group.matches).toFixed(1), longest: group.longest,
    meanCardsPerRound: +(group.cards / group.rounds).toFixed(2), commitments: group.counts,
    trophiesPerCard: +(group.trophies / group.cards).toFixed(3),
  }]));
  const camps = placementPolicies.filter(policy => !["adaptive", "rotating-pair", "rotating-three", "full-push"].includes(policy));
  const bestCamp = camps.reduce((best, policy) => metrics[policy].scorePct > metrics[best].scorePct ? policy : best, camps[0]);
  const pairedBestCampAdvantage = paired.reduce((sum, result) => sum + result[bestCamp] - result.adaptive, 0) / paired.length;
  const matchedWidthComparisons = [
    { maxCards: 2, fixed: ["left-pair", "right-pair", "centre-pair", "outer-pair"], rotating: "rotating-pair" },
    { maxCards: 3, fixed: ["left-three", "right-three", "outer-left-three", "outer-right-three"], rotating: "rotating-three" },
  ].map(row => {
    const bestFixed = row.fixed.reduce((best, policy) => metrics[policy].scorePct > metrics[best].scorePct ? policy : best, row.fixed[0]);
    return { maxCards: row.maxCards, bestFixed, fixedScorePct: metrics[bestFixed].scorePct,
      rotatingScorePct: metrics[row.rotating].scorePct,
      pairedBestFixedMinusRotatingPct: +(100 * paired.reduce((sum, result) => sum + result[bestFixed] - result[row.rotating], 0) / paired.length).toFixed(1) };
  });
  const preferred = consistency.map(row => ({ id: row.id, partialByCount: row.partial,
    preferredPctByCount: row.partial.map((count, index) => count ? +(100 * row.preferred[index] / count).toFixed(1) : null), excludedFull: row.full }));
  return { matches: trials * 16 * placementPolicies.length, pairedMatchups: paired.length, elapsedSeconds: +((performance.now() - start) / 1000).toFixed(2),
    maxProbePlanningMs: +Math.max(...planningMs).toFixed(1), metrics, matchedWidthComparisons, preferred,
    bestFixedPolicy: bestCamp, pairedBestFixedMinusAdaptivePct: +(100 * pairedBestCampAdvantage).toFixed(1),
    note: "Public habits and completed history only; paired shuffles. Fixed pairs/triples and rotating equivalents have matched lane limits; adaptive 1–4, full-push largest legal commitment. Not a proof of human balance." };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(runPlacementAudit(Number(process.argv[2] || 1), Number(process.argv[3] || 746381)), null, 2));
}
