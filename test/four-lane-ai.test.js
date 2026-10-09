import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import "../src/rules.js";
import "../src/four-lane-rules.js";

const n = globalThis.ClawRules, r = globalThis.ClawFourLaneRules;
const occupied = formation => formation.filter(Boolean);
const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const card = (power, element = "gust", tactic = "rally") => Object.freeze({ power, element, tactic });
const hand = Object.freeze([card(9, "ember", "finisher"), card(8, "tide", "vanguard"),
  card(6, "gust", "link"), card(5, "tide", "rally"), card(4, "ember", "rally"), card(3, "gust", "finisher"), card(5, "ember", "link")]);
const rounds = counts => counts.map(count => Object.freeze({
  playerCards: Object.freeze(Array.from({ length: count }, (_, i) => card(count === 1 ? 9 : 3 + i))),
  aiCards: Object.freeze([card(5)]) }));

test("public history learns repeating pushes and recovery, with uncertainty", () => {
  const read = r.readPlayerHistory(rounds([4, 1, 4, 1, 1, 4, 1, 1]));
  assert.equal(read.repeatedCount, 4);
  assert.equal(read.estimatedHand, 7);
  assert.ok(read.commitmentProbabilities[3] > .5);
  assert.ok(read.commitmentProbabilities[0] > 0);
  assert.ok(Math.abs(read.commitmentProbabilities.reduce((a, b) => a + b) - 1) < 1e-12);
  const recovering = r.readPlayerHistory(rounds([4, 4, 4, 4]));
  assert.equal(recovering.estimatedHand, 3);
  assert.equal(recovering.commitmentProbabilities[3], 0);
});

test("invalid history entries cannot produce an invalid belief or mutate valid rounds", () => {
  const history = Object.freeze([null, {}, { playerCards: [] }, { playerCards: [card(NaN)] }, ...rounds([2, 2])]);
  const before = JSON.stringify(history);
  const read = r.readPlayerHistory(history);
  assert.equal(read.rounds.length, 2);
  assert.equal(read.repeatedCount, 2);
  assert.equal(JSON.stringify(history), before);
});

test("public reads adapt when the player abandons an old push/recovery pattern", () => {
  const read = r.readPlayerHistory(rounds([4, 1, 4, 1, 1, 4, 1, 1, 2, 2, 2]));
  assert.equal(read.repeatedCount, 2);
  assert.ok(read.commitmentProbabilities[1] > .5);
});

test("public history preserves physical lanes and predicts hand size, copy availability and recycling", () => {
  let reshuffles = 0;
  for (let seed = 0; seed < 64; seed++) {
    const random = rng(19091 + seed), templates = Array.from({ length: 12 }, (_, index) => ({
      art: `template-${index}`, power: 3 + index % 4,
      element: ["ember", "gust", "tide"][index % 3], tactic: "none", rarity: "common",
    }));
    const deck = templates.flatMap(value => [0, 1].map(copy => ({ ...value, instanceId: `${value.art}-${copy}` })));
    const actualHand = deck.splice(0, 7), discard = [], history = [];
    const beforeTemplates = JSON.stringify(templates);
    for (let round = 0; round < 48; round++) {
      const count = Math.min(actualHand.length, 1 + Math.floor(random() * 4));
      const positions = [0, 1, 2, 3].sort(() => random() - .5).slice(0, count);
      const formation = Array(4).fill(null);
      for (const lane of positions) {
        const [chosen] = actualHand.splice(Math.floor(random() * actualHand.length), 1);
        formation[lane] = { art: chosen.art, element: chosen.element, power: chosen.power, tactic: chosen.tactic };
        discard.push(chosen);
      }
      history.push({ playerCards: formation });
      // Independent physical-deck draw: no production history/refill helper.
      for (let draw = 0, amount = Math.min(3, 7 - actualHand.length); draw < amount; draw++) {
        if (!deck.length) { deck.push(...discard.splice(0)); reshuffles++; }
        actualHand.push(deck.shift());
      }
      const beforeHistory = JSON.stringify(history), read = r.readPlayerHistory(history);
      assert.equal(read.estimatedHand, actualHand.length);
      assert.equal(read.estimatedDrawPile, deck.length);
      const unavailable = {};
      for (const value of discard) unavailable[value.art] = (unavailable[value.art] || 0) + 1;
      assert.deepEqual(read.unavailable, unavailable);
      assert.deepEqual(read.rounds.at(-1), formation, "history must not compact a gap into another lane");
      assert.ok(Math.abs(read.commitmentProbabilities.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
      assert.ok(Math.abs(read.maskProbabilities.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
      read.commitmentProbabilities.forEach((weight, index) => {
        assert.ok(Number.isFinite(weight) && weight >= 0);
        if (index + 1 > actualHand.length) assert.equal(weight, 0);
      });
      assert.equal(JSON.stringify(history), beforeHistory);
    }
    assert.equal(JSON.stringify(templates), beforeTemplates);
  }
  assert.ok(reshuffles > 0);
});

test("forecast scenarios respect physical masks, public copy limits and unavailable revealed cards", () => {
  const publicCards = Object.freeze(Array.from({ length: 12 }, (_, index) => Object.freeze({
    art: `public-${index}`, power: 3 + index % 5,
    element: ["ember", "gust", "tide"][index % 3],
    tactic: ["vanguard", "link", "finisher", "rally"][index % 4], rarity: "common",
  })));
  const history = Object.freeze([
    { playerCards: [null, publicCards[0], null, null] },
    { playerCards: [null, publicCards[0], publicCards[1], publicCards[2]] },
  ]);
  const read = r.readPlayerHistory(history), before = JSON.stringify({ publicCards, history, read });
  for (let seed = 0; seed < 24; seed++) {
    const scenarios = r.buildPlayerScenarios(read, publicCards, rng(seed));
    assert.ok(scenarios.length > 0);
    assert.ok(Math.abs(scenarios.reduce((sum, value) => sum + value.weight, 0) - 1) < 1e-12);
    for (const scenario of scenarios) {
      assert.equal(scenario.cards.length, 4);
      assert.equal(scenario.count, occupied(scenario.cards).length);
      assert.equal(scenario.mask, r.getFormationMask(scenario.cards));
      assert.ok(scenario.count <= read.estimatedHand);
      assert.ok(Number.isFinite(scenario.weight) && scenario.weight > 0);
      const copies = {};
      for (const value of occupied(scenario.cards)) copies[value.art] = (copies[value.art] || 0) + 1;
      for (const [art, count] of Object.entries(copies)) assert.ok(count <= 2 - (read.unavailable[art] || 0));
      assert.equal(copies[publicCards[0].art], undefined, "both revealed copies remain unavailable until recycling");
    }
    for (let mask = 1; mask < 16; mask++) {
      const weight = scenarios.filter(value => value.mask === mask).reduce((sum, value) => sum + value.weight, 0);
      assert.ok(Math.abs(weight - read.maskProbabilities[mask]) < 1e-12);
    }
  }
  assert.equal(JSON.stringify({ publicCards, history, read }), before);
});

test("joint planning keeps commitment preferences and puts Rally after the Vanguard it supports", () => {
  const balanced = Array.from({ length: 7 }, (_, i) => card(5,
    ["ember", "gust", "tide"][i % 3], ["vanguard", "link", "finisher", "rally"][i % 4]));
  const info = { history: [{ playerCards: balanced.slice(0, 4), aiCards: balanced.slice(0, 2) }] };
  const full = r.chooseAiFormation(balanced, [], [], () => .4, [{ id: "full-formation" }], info);
  const measured = r.chooseAiFormation(balanced, [], [], () => .4, [{ id: "measured-planner" }], info);
  assert.ok(occupied(full).length >= occupied(measured).length);
  assert.ok(occupied(full).length >= 2);
  const pair = [card(5, "gust", "vanguard"), card(4, "gust", "rally")];
  const history = Array.from({ length: 6 }, () => ({ playerCards: [card(6, "gust", "none"), card(6, "gust", "none")] }));
  const formation = r.chooseAiFormation(pair, {}, { ember: 6, gust: 4, tide: 6 }, () => .4, [], { history });
  assert.deepEqual(formation, [...pair, null, null]);
  assert.equal(r.getRallyBonus(formation, 0) + r.getTacticBonus(formation, 0), 2);
});

test("the joint planner returns unique own-hand references, is deterministic and does not mutate input", () => {
  const history = Object.freeze(rounds([4, 1, 1, 4, 1, 1]));
  const info = Object.freeze({ history, cardLibrary: hand });
  const before = JSON.stringify(info);
  for (let size = 0; size <= 7; size++) {
    const available = Object.freeze(hand.slice(0, size));
    const chosen = r.chooseAiFormation(available, [], [], rng(75), [], info);
    const cards = occupied(chosen);
    assert.equal(new Set(cards).size, cards.length);
    assert.ok(cards.length <= Math.min(size, 4));
    if (size) { assert.ok(cards.length >= 1); assert.equal(chosen.length, 4); }
    assert.ok(cards.every(value => available.includes(value)));
    assert.deepEqual(chosen, r.chooseAiFormation(available, [], [], rng(75), [], info));
  }
  assert.equal(JSON.stringify(info), before);
});

test("every habit profile stays legal and explicit strongest-card ordering remains truthful", () => {
  for (const motive of n.AI_MOTIVE_TRAITS) for (const formation of n.AI_FORMATION_TRAITS) for (const commitment of n.AI_COMMITMENT_TRAITS) {
    const traits = [motive.id === "element-loyalist" ? { ...motive, element: "tide" } : motive, formation, commitment];
    const chosen = r.chooseAiFormation(hand, [card(3, "tide")], [card(5, "ember")], rng(120), traits,
      { history: rounds([4, 1, 1, 4, 1, 1]) });
    const cards = occupied(chosen);
    assert.ok(cards.length >= 1 && cards.length <= 4 && new Set(cards).size === cards.length);
    if (formation.id === "strong-opener") assert.equal(chosen[0].power, Math.max(...cards.map(card => card.power)));
    if (formation.id === "late-striker") assert.equal(chosen.findLast(Boolean).power, Math.max(...cards.map(card => card.power)));
  }
});

test("private player fields are never inspected by the pure planner", () => {
  const info = { history: rounds([2, 2]), cardLibrary: hand };
  for (const key of ["playerHand", "playerDeck", "selectedCardIds", "playerFormation"]) {
    Object.defineProperty(info, key, { get() { throw Error("private access: " + key); } });
  }
  assert.ok(r.chooseAiFormation(hand, [], [], rng(3), [], info).length);
});

test("Four-Lane plans before the reveal using public inputs; Normal Play retains its original AI", () => {
  const source = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
  const start = source.indexOf("function prepareAiPlan(");
  const prepare = source.slice(start, source.indexOf("\n}", start) + 2);
  assert.doesNotMatch(prepare, /state\.(playerHand|selectedCardIds|deck|playerPlayZone)/);
  const publicHistory = rounds([4, 1]), ownHand = [...hand], playerTrophies = [], aiTrophies = [];
  let plannerCalls = 0, oldCalls = 0;
  const context = { state: { aiHand: ownHand, playerWins: playerTrophies, aiWins: aiTrophies,
    playerProgress: playerTrophies, aiProgress: aiTrophies,
    aiTraits: [], previousRoundsHistory: publicHistory, difficulty: "instinct", previousPlayerCommitment: 1, previousAiCommitment: 2 },
    Math, CARD_LIBRARY: hand.slice(0, 4), FOUR_LANE_CARDS: hand.slice(4),
    matchFourLaneOpponent: { profile: { role: "rally" } },
    isFourLaneMode: () => true,
    duelRules: () => ({ chooseAiFormation(h, p, a, random, traits, info, role) {
      plannerCalls++; assert.equal(h, ownHand); assert.equal(p, playerTrophies); assert.equal(a, aiTrophies);
      assert.equal(info.history, publicHistory); assert.deepEqual(Object.keys(info).sort(), ["cardLibrary", "history"]);
      assert.equal(role, "rally");
      return h.slice(0, 2);
    } }),
    chooseAiCommitment: () => { oldCalls++; return 1; },
    chooseAiCards: () => { oldCalls++; return ownHand.slice(0, 1); }, buildTellClues: r.buildTellClues };
  runInNewContext(prepare, context); context.prepareAiPlan();
  assert.equal(plannerCalls, 1); assert.equal(oldCalls, 0);
  assert.deepEqual(context.state.aiTellClues, ["sealed", "sealed", "sealed", "sealed"]);
  context.isFourLaneMode = () => false; context.prepareAiPlan();
  assert.equal(plannerCalls, 1); assert.equal(oldCalls, 2); assert.equal(context.state.aiPlan.length, 1);
});

test("seven-card exhaustive planning is bounded for responsive turns", () => {
  const started = performance.now();
  for (let seed = 0; seed < 50; seed++) r.chooseAiFormation(hand, [], [], rng(seed), [], { history: rounds([2, 2]) });
  assert.ok(performance.now() - started < 2000, "50 complete searches should take less than two seconds");
});
