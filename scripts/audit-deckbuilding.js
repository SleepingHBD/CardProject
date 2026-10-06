// Deterministic strategy probes, not a proof that every deck or human strategy is balanced.
// Usage: node scripts/audit-deckbuilding.js [trials-per-matchup=4] [seed=24519]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import "../src/rules.js";
import "../src/four-lane-rules.js";
import "../src/deckbuilding.js";
import "../src/opponents.js";

const normal = globalThis.ClawRules, four = globalThis.ClawFourLaneRules;
const decks = globalThis.ClawDeckbuilding, opponents = globalThis.ClawFourLaneOpponents;
const source = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
export const library = runInNewContext([
  source.slice(source.indexOf("const CARD_LIBRARY ="), source.indexOf("const HAND_SIZE =")),
  source.slice(source.indexOf("const FOUR_LANE_RALLY_CARDS ="), source.indexOf("const DIFFICULTIES =")),
  "[...CARD_LIBRARY, ...FOUR_LANE_CARDS]",
].join("\n"));
export const catalog = decks.createCardCatalog(library);
export const roster = opponents.createRoster(catalog);
export const policies = Object.freeze(["adaptive", "one", "two", "three", "four", "cycle-3-1", "cycle-4-1-1", "cheap-second", "solo-farm"]);
export const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);

export function createAuditDecks(seed = 24519) {
  const result = [...decks.createStarterPresets(catalog)];
  const definitions = [
    { id: "low-cost", value: card => -card.cost },
    { id: "power-curve", value: card => card.power },
    { id: "premium-heavy", value: card => card.power + (card.rarity === "legendary" ? 5 : 0) },
    ...decks.ELEMENTS.map(element => ({ id: `heavy-${element}`, value: card => Number(card.element === element) * 8 + card.power * .1 })),
    ...decks.ROLES.map(role => ({ id: `no-${role}`, allowed: card => card.tactic !== role, value: card => card.power })),
    ...Array.from({ length: 3 }, (_, index) => ({ id: `random-${index + 1}`, random: true })),
  ];
  for (const [index, probe] of definitions.entries()) {
    const random = rng(seed + index * 8191);
    const allowed = catalog.cards.filter(probe.allowed || (() => true));
    // A cheap legal seed prevents the search from accepting an unfinished deck.
    const expanded = allowed.flatMap(card => Array(card.copyLimit).fill(card))
      .sort((a, b) => a.cost - b.cost || a.key.localeCompare(b.key));
    const selected = [];
    for (const element of decks.ELEMENTS) selected.push(...expanded.filter(card => card.element === element).slice(0, 4));
    const remaining = [...expanded];
    selected.forEach(card => remaining.splice(remaining.indexOf(card), 1));
    selected.push(...remaining.slice(0, decks.DECK_SIZE - selected.length));
    const definition = { id: probe.id, version: decks.VERSION, name: probe.id, cards: selected.map(card => card.key) };
    assert.ok(decks.validateDeck(catalog, definition).valid);
    for (let step = 0; step < 1200; step++) {
      const slot = Math.floor(random() * definition.cards.length), next = allowed[Math.floor(random() * allowed.length)];
      const prior = catalog.byKey[definition.cards[slot]];
      if (!probe.random && probe.value(next) < probe.value(prior)) continue;
      const cards = [...definition.cards]; cards[slot] = next.key;
      if (decks.validateDeck(catalog, { ...definition, cards }).valid) definition.cards = cards;
    }
    result.push(Object.freeze({ ...definition, cards: Object.freeze(definition.cards) }));
  }
  return Object.freeze(result);
}

function permutations(cards) {
  return cards.length < 2 ? [[...cards]] : cards.flatMap((card, i) =>
    permutations(cards.filter((_, j) => i !== j)).map(rest => [card, ...rest]));
}

function roleOrder(cards) {
  let best = cards, score = -Infinity;
  for (const formation of permutations(cards)) {
    const value = formation.reduce((sum, _, lane) => sum + four.getTacticBonus(formation, lane) + four.getRallyBonus(formation, lane), 0)
      + formation[0].power * .001;
    if (value > score) { score = value; best = formation; }
  }
  return best;
}

export function selectProbe(side, policy, round, history, random) {
  if (policy === "adaptive") return four.chooseAiFormation(side.hand, side.other.trophies, side.trophies, random, [],
    { history: history.map(value => ({ playerCards: value.aiCards, aiCards: value.playerCards })), cardLibrary: library });
  const counts = normal.getElementTrophyCounts(side.trophies);
  const ordered = [...side.hand].sort((a, b) => (b.power + Number(counts[b.element] < 2) * .5 + Number(b.tactic === "vanguard") * .25)
    - (a.power + Number(counts[a.element] < 2) * .5 + Number(a.tactic === "vanguard") * .25));
  let count = { one: 1, two: 2, three: 3, four: 4, "cheap-second": 2 }[policy];
  if (policy === "cycle-3-1") count = [3, 1][round % 2];
  if (policy === "cycle-4-1-1") count = [4, 1, 1][round % 3];
  if (policy === "solo-farm") count = side.hand.length >= 6 ? 4 : 1;
  assert.ok(Number.isInteger(count), "Unknown audit policy");
  count = Math.min(count, side.hand.length);
  if (policy === "solo-farm" && count === 4) {
    const cheap = [...side.hand].sort((a, b) => a.power - b.power), first = cheap[0];
    const trophy = cheap.find(card => card !== first && counts[card.element] < 2) || cheap[1];
    return [first, trophy, ...cheap.filter(card => card !== first && card !== trophy).slice(0, 2)];
  }
  if (policy === "cheap-second" && count === 2) {
    let best, score = -Infinity;
    for (const first of side.hand) for (const second of side.hand) if (first !== second) {
      const pair = [first, second];
      const value = first.power + four.getTacticBonus(pair, 0) + four.getRallyBonus(pair, 0)
        - second.power * .15 + Number(counts[first.element] < 2) * .25;
      if (value > score) { score = value; best = pair; }
    }
    return best;
  }
  return roleOrder(ordered.slice(0, count));
}

export function simulateDuel(definition, rivalId, policy, seed, maxRounds = 150) {
  const encounter = opponents.createEncounter(roster, rivalId, rng(seed + 60013));
  const habitsBefore = JSON.stringify(encounter.traits);
  const sides = [definition, encounter.deck].map((deckDefinition, index) => {
    const random = rng(seed + index * 8191), deck = [], discard = decks.buildDeckInstances(catalog, deckDefinition, index ? "opponent" : "player");
    normal.reshuffleDiscardPile(deck, discard, random);
    const side = { deck, discard, hand: [], trophies: [], random };
    four.replenishHand(deck, discard, side.hand, four.HAND_SIZE, random);
    return side;
  });
  sides[0].other = sides[1]; sides[1].other = sides[0];
  const decisions = [rng(seed + 31001), rng(seed + 41001)], history = [];
  const report = { winner: "stalled", rounds: 0, draws: 0, reshuffles: 0, counts: [[0, 0, 0, 0], [0, 0, 0, 0]],
    activations: { vanguard: 0, link: 0, finisher: 0, rally: 0 }, maxPlanningMs: 0 };
  for (let round = 0; round < maxRounds; round++) {
    const start = performance.now();
    // Rival planning happens independently, before the probe chooses its cards.
    const ai = four.chooseAiFormation(sides[1].hand, sides[0].trophies, sides[1].trophies, decisions[1], encounter.traits,
      { history, cardLibrary: library }, encounter.profile.role);
    report.maxPlanningMs = Math.max(report.maxPlanningMs, performance.now() - start);
    const plays = [selectProbe(sides[0], policy, round, history, decisions[0]), ai];
    plays.forEach((cards, side) => {
      assert.ok(cards.length >= 1 && cards.length <= 4 && new Set(cards).size === cards.length);
      assert.ok(cards.every(card => sides[side].hand.includes(card)));
      report.counts[side][cards.length - 1]++;
      cards.forEach((card, lane) => {
        if (four.getTacticBonus(cards, lane)) report.activations[card.tactic]++;
        if (four.getRallyBonus(cards, lane)) report.activations.rally++;
      });
    });
    const result = four.resolveClashes(...plays);
    assert.ok(result.extraCardPoints.player <= 2 && result.extraCardPoints.ai <= 2);
    report.rounds++; report.draws += Number(result.winner === "draw");
    const winner = result.winner === "draw" ? -1 : result.winner === "player" ? 0 : 1;
    const options = four.getFormationRewardOptions(...plays, result);
    const reward = options.length ? normal.chooseTrophyReward(options, sides[winner].trophies) : null;
    if (reward) assert.ok(options.some(option => option.card === reward.card));
    sides.forEach((side, index) => {
      side.hand = side.hand.filter(card => !plays[index].includes(card));
      side.discard.push(...plays[index].filter(card => card !== reward?.card));
      if (reward && index === winner) side.trophies.push(reward.card);
      const all = [...side.deck, ...side.discard, ...side.hand, ...side.trophies];
      assert.equal(all.length, 24);
      assert.equal(new Set(all.map(card => card.instanceId)).size, 24);
      assert.ok(all.every(card => card.instanceId.startsWith(index ? "opponent-" : "player-")));
      assert.ok(side.trophies.every(card => !side.deck.includes(card) && !side.discard.includes(card) && !side.hand.includes(card)));
    });
    const snapshot = cards => cards.map(({ art, element, power, tactic }) => ({ art, element, power, tactic }));
    history.push({ playerCards: snapshot(plays[0]), aiCards: snapshot(plays[1]) });
    const completed = sides.findIndex(side => normal.hasCompletedElementSet(side.trophies));
    if (completed >= 0) { report.winner = completed ? "opponent" : "player"; break; }
    sides.forEach(side => {
      const before = side.hand.length;
      const refill = four.replenishHand(side.deck, side.discard, side.hand, four.ROUND_DRAW, side.random);
      report.reshuffles += Number(refill.reshuffled);
      assert.ok(refill.drawn <= 2 && side.hand.length >= 1 && side.hand.length <= 7 && side.hand.length - before === refill.drawn);
    });
  }
  assert.equal(JSON.stringify(encounter.traits), habitsBefore);
  return report;
}

function group() { return { matches: 0, playerWins: 0, stalls: 0, rounds: 0, longest: 0 }; }
function add(target, result) {
  target.matches++; target.playerWins += Number(result.winner === "player"); target.stalls += Number(result.winner === "stalled");
  target.rounds += result.rounds; target.longest = Math.max(target.longest, result.rounds);
}
function finish(target) {
  return { ...target, playerWinPercent: +(target.playerWins / target.matches * 100).toFixed(1), avgRounds: +(target.rounds / target.matches).toFixed(1) };
}

export async function audit({ trials = 4, seed = 24519, progress = () => {} } = {}) {
  assert.ok(Number.isInteger(trials) && trials >= 1 && trials <= 50);
  assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff);
  const auditDecks = createAuditDecks(seed), total = group(), byPolicy = {}, byRival = {}, byDeck = {}, cells = [], stalls = [];
  const counts = [[0, 0, 0, 0], [0, 0, 0, 0]], activations = { vanguard: 0, link: 0, finisher: 0, rally: 0 };
  let reshuffles = 0, maxPlanningMs = 0;
  const started = performance.now(), expected = auditDecks.length * roster.length * policies.length * trials;
  for (const [deckIndex, definition] of auditDecks.entries()) for (const [rivalIndex, rival] of roster.entries()) {
    for (const policy of policies) {
      const cell = { deck: definition.id, rival: rival.id, policy, ...group() };
      for (let trial = 0; trial < trials; trial++) {
        // Same shuffle/habit/AI streams across policies for a paired comparison.
        const matchSeed = (seed + deckIndex * 1000003 + rivalIndex * 100003 + trial * 101) >>> 0;
        const result = simulateDuel(definition, rival.id, policy, matchSeed);
        add(total, result); add(cell, result);
        add(byPolicy[policy] ||= group(), result); add(byRival[rival.id] ||= group(), result); add(byDeck[definition.id] ||= group(), result);
        reshuffles += result.reshuffles; maxPlanningMs = Math.max(maxPlanningMs, result.maxPlanningMs);
        counts.forEach((side, index) => side.forEach((_, count) => { side[count] += result.counts[index][count]; }));
        for (const role of decks.ROLES) activations[role] += result.activations[role];
        if (result.winner === "stalled") stalls.push({ deck: definition.id, rival: rival.id, policy, seed: matchSeed });
        if (total.matches % 96 === 0) { progress(`${total.matches}/${expected} duels`); await new Promise(resolve => setImmediate(resolve)); }
      }
      cells.push(finish(cell));
    }
  }
  return { seed, trials, ...finish(total), durationMs: Math.round(performance.now() - started), reshuffles, maxPlanningMs: +maxPlanningMs.toFixed(2),
    counts, activations, stalledMatches: stalls, byPolicy: Object.fromEntries(Object.entries(byPolicy).map(([key, value]) => [key, finish(value)])),
    byRival: Object.fromEntries(Object.entries(byRival).map(([key, value]) => [key, finish(value)])),
    byDeck: Object.fromEntries(Object.entries(byDeck).map(([key, value]) => [key, finish(value)])),
    deckComposition: auditDecks.map(definition => ({ id: definition.id, ...decks.validateDeck(catalog, definition).summary })),
    cells };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await audit({ trials: Number(process.argv[2] || 4), seed: Number(process.argv[3] || 24519), progress: message => console.error(message) });
  // Detailed reproducible cells are returned by audit() for investigations; keep the CLI readable.
  const { cells, deckComposition, ...summary } = report;
  console.log(JSON.stringify({ ...summary, decks: deckComposition.map(({ id, totalCost, elementCounts, roleCounts }) => ({ id, totalCost, elementCounts, roleCounts })),
    strongestCells: [...cells].sort((a, b) => b.playerWinPercent - a.playerWinPercent).slice(0, 12) }, null, 2));
  if (report.stalledMatches.length) process.exitCode = 1;
}
