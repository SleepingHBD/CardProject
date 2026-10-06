import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import "../src/rules.js";
import "../src/four-lane-rules.js";

const n = globalThis.ClawRules, r = globalThis.ClawFourLaneRules;
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
  assert.equal(read.estimatedHand, 6);
  assert.ok(read.commitmentProbabilities[3] > .5);
  assert.ok(read.commitmentProbabilities[0] > 0);
  assert.ok(Math.abs(read.commitmentProbabilities.reduce((a, b) => a + b) - 1) < 1e-12);
  const recovering = r.readPlayerHistory(rounds([4, 4]));
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

test("joint planning keeps commitment preferences and recognises Rally/Finisher support", () => {
  const balanced = Array.from({ length: 7 }, (_, i) => card(5,
    ["ember", "gust", "tide"][i % 3], ["vanguard", "link", "finisher", "rally"][i % 4]));
  const info = { history: [{ playerCards: balanced.slice(0, 4), aiCards: balanced.slice(0, 2) }] };
  const full = r.chooseAiFormation(balanced, [], [], () => .4, [{ id: "full-formation" }], info);
  const measured = r.chooseAiFormation(balanced, [], [], () => .4, [{ id: "measured-planner" }], info);
  assert.equal(full.length, 4);
  assert.ok(measured.length < full.length);
  const pair = [card(4, "gust", "rally"), card(5, "gust", "finisher")];
  const history = Array.from({ length: 6 }, () => ({ playerCards: [card(6, "gust", "none"), card(6, "gust", "none")] }));
  const formation = r.chooseAiFormation(pair, [], [], () => .4, [], { history });
  assert.deepEqual(formation, pair);
  assert.equal(r.getRallyBonus(formation, 1) + r.getTacticBonus(formation, 1), 2);
});

test("the joint planner returns unique own-hand references, is deterministic and does not mutate input", () => {
  const history = Object.freeze(rounds([4, 1, 1, 4, 1, 1]));
  const info = Object.freeze({ history, cardLibrary: hand });
  const before = JSON.stringify(info);
  for (let size = 0; size <= 7; size++) {
    const available = Object.freeze(hand.slice(0, size));
    const chosen = r.chooseAiFormation(available, [], [], rng(75), [], info);
    assert.equal(new Set(chosen).size, chosen.length);
    assert.ok(chosen.length <= Math.min(size, 4));
    if (size) assert.ok(chosen.length >= 1);
    assert.ok(chosen.every(value => available.includes(value)));
    assert.deepEqual(chosen, r.chooseAiFormation(available, [], [], rng(75), [], info));
  }
  assert.equal(JSON.stringify(info), before);
});

test("every habit profile stays legal and explicit strongest-card ordering remains truthful", () => {
  for (const motive of n.AI_MOTIVE_TRAITS) for (const formation of n.AI_FORMATION_TRAITS) for (const commitment of n.AI_COMMITMENT_TRAITS) {
    const traits = [motive.id === "element-loyalist" ? { ...motive, element: "tide" } : motive, formation, commitment];
    const chosen = r.chooseAiFormation(hand, [card(3, "tide")], [card(5, "ember")], rng(120), traits,
      { history: rounds([4, 1, 1, 4, 1, 1]) });
    assert.ok(chosen.length >= 1 && chosen.length <= 4 && new Set(chosen).size === chosen.length);
    if (formation.id === "strong-opener") assert.equal(chosen[0].power, Math.max(...chosen.map(card => card.power)));
    if (formation.id === "late-striker") assert.equal(chosen.at(-1).power, Math.max(...chosen.map(card => card.power)));
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
    aiTraits: [], previousRoundsHistory: publicHistory, difficulty: "instinct", previousPlayerCommitment: 1, previousAiCommitment: 2 },
    Math, CARD_LIBRARY: hand.slice(0, 4), FOUR_LANE_CARDS: hand.slice(4),
    isFourLaneMode: () => true,
    duelRules: () => ({ chooseAiFormation(h, p, a, random, traits, info) {
      plannerCalls++; assert.equal(h, ownHand); assert.equal(p, playerTrophies); assert.equal(a, aiTrophies);
      assert.equal(info.history, publicHistory); assert.deepEqual(Object.keys(info).sort(), ["cardLibrary", "history"]);
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
