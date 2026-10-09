import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import "../src/rules.js";
import "../src/four-lane-rules.js";

const normal = globalThis.ClawRules, four = globalThis.ClawFourLaneRules;
const source = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const card = (power = 5, element = "gust") => Object.freeze({ power, element, tactic: "none" });
const shape = mask => Array.from({ length: 4 }, (_, lane) => mask & 1 << lane ? card() : null);
const gameFunction = name => {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1);
  return source.slice(start, source.indexOf("\n}", start) + 2);
};

test("WIP placement catalogue is canonical and frozen without changing Normal Play's three categories", () => {
  assert.equal(four.PLACEMENT_HABIT_RATE, .8);
  assert.equal(four.PLACEMENT_ESCAPE_MARGIN, 1.5);
  assert.ok(Object.isFrozen(four.AI_PLACEMENT_TRAITS));
  assert.deepEqual(four.AI_PLACEMENT_TRAITS.map(trait => [trait.id, trait.label, trait.preferredLanes]), [
    ["left-flank", "Left Flank", [0, 1]], ["right-flank", "Right Flank", [2, 3]],
    ["centre-guard", "Centre Guard", [1, 2]], ["outer-guard", "Outer Guard", [0, 3]],
  ]);
  for (const trait of four.AI_PLACEMENT_TRAITS) {
    assert.equal(trait.category, "placement");
    assert.ok(Object.isFrozen(trait) && Object.isFrozen(trait.preferredLanes));
    assert.match(trait.description, /Usually prioritises Lanes \d and \d\. Can shift when those lanes are risky\./);
  }
  assert.deepEqual(normal.createAiTraits(() => .5).map(trait => trait.category), ["motive", "formation", "commitment"]);
  assert.deepEqual(four.createAiTraits(() => .5).map(trait => trait.category), ["motive", "placement", "commitment"]);
});

test("placement compatibility checks all 60 shapes by physical occupied count, not array length", () => {
  let cases = 0;
  for (const trait of four.AI_PLACEMENT_TRAITS) for (let mask = 1; mask < 16; mask++) {
    const cards = shape(mask), count = cards.filter(Boolean).length;
    const lanes = cards.flatMap((value, lane) => value ? [lane] : []);
    const expected = count <= 2 ? lanes.every(lane => trait.preferredLanes.includes(lane))
      : trait.preferredLanes.every(lane => lanes.includes(lane));
    assert.equal(four.isPreferredPlacement(cards, trait), expected, `${trait.id}, mask ${mask}`);
    assert.equal(four.isPreferredPlacement(cards, trait.id), expected);
    assert.equal(four.isPreferredPlacement(cards, { ...trait, preferredLanes: [99] }), expected,
      "caller-supplied lane metadata cannot replace the canonical preference");
    cases++;
  }
  assert.equal(cases, 60);
  for (const invalid of [null, [], [null, null, null, null], [card(), null, null, null, card()]]) {
    assert.equal(four.isPreferredPlacement(invalid, "left-flank"), false);
  }
  assert.equal(four.isPreferredPlacement(shape(3), "__proto__"), false);
});

test("same-hand neutral controls reveal each habit at one-, two- and three-card commitments", () => {
  const controls = [{ handSize: 1, count: 1 }, { handSize: 2, count: 2 }, { handSize: 5, count: 3 }];
  const library = Array.from({ length: 8 }, () => card());
  for (const { handSize, count } of controls) for (const trait of four.AI_PLACEMENT_TRAITS) {
    const hand = Object.freeze(library.slice(0, handSize));
    const before = JSON.stringify([hand, trait]);
    let preferred = 0;
    for (let sample = 0; sample < 100; sample++) {
      const seed = (82741 + Math.imul(sample + 1, 2654435761)) >>> 0;
      const plan = four.chooseAiFormation(hand, {}, {}, rng(seed), [trait], { cardLibrary: library, history: [] });
      assert.equal(plan.filter(Boolean).length, count);
      assert.ok(plan.filter(Boolean).every(value => hand.includes(value)));
      assert.equal(new Set(plan.filter(Boolean)).size, count);
      preferred += Number(four.isPreferredPlacement(plan, trait));
    }
    // Anchoring occurs on 80% of decisions; the free 20% can also happen to
    // choose a favoured shape. Do not mistake this tendency for a hard lock.
    assert.ok(preferred >= 70 && preferred < 100, `${trait.id}/${count}: ${preferred}% preferred`);
    assert.equal(JSON.stringify([hand, trait]), before, "selection never mutates cards or persistent traits");
  }
});

test("favoured-lane danger can override an anchored roll rather than donate a finishing victory", () => {
  const weak = card(3), strong = card(9, "ember");
  const history = Object.freeze(Array.from({ length: 24 }, () => Object.freeze({
    playerCards: Object.freeze([strong, strong, null, null]),
  })));
  const info = Object.freeze({ history, cardLibrary: Object.freeze(Array(8).fill(strong)) });
  const trait = four.AI_PLACEMENT_TRAITS[0], before = JSON.stringify([info, trait]);
  const plan = four.chooseAiFormation([weak], { ember: 4, gust: 6, tide: 6 }, {}, () => .1, [trait], info);
  assert.equal(plan.filter(Boolean).length, 1);
  assert.equal(four.isPreferredPlacement(plan, trait), false, "the anchor roll is 0.1 but finishing danger forces a shift");
  assert.ok(plan[2] || plan[3]);
  assert.equal(JSON.stringify([info, trait]), before);
});

test("placement tendencies do not restrict the player's 1,960 free plans or modify their scoring", () => {
  const hand = Array.from({ length: 7 }, (_, index) => card(index + 3, ["ember", "gust", "tide"][index % 3]));
  const plans = four.enumerateFormations(hand);
  assert.equal(plans.length, 1960);
  assert.equal(new Set(plans.map(four.getFormationMask)).size, 15);
  for (let mask = 1; mask < 16; mask++) {
    const cards = shape(mask), opposing = [card(3), card(3), card(3), card(3)];
    const before = JSON.stringify(cards), result = four.resolveProgress(cards, opposing, {}, {});
    assert.equal(result.progressAfter.player.gust, Math.min(6, cards.filter(Boolean).length * 2));
    assert.equal(result.score.ai, 0);
    assert.equal(result.extraCardPoints.player, 0);
    assert.equal(JSON.stringify(cards), before, "free placement scoring never relocates or mutates player cards");
  }
  for (const trait of four.AI_PLACEMENT_TRAITS) assert.ok(four.isPreferredPlacement(shape(15), trait));
});

test("Instinct's lane map is a public tendency, not a leak of the current plan; Normal stays unchanged", () => {
  const context = { state: { gameMode: "four-lane", difficulty: "instinct", aiTraits: four.createAiTraits(() => .1),
    aiPlan: shape(12) }, ui: { opponentHabits: {} } };
  runInNewContext(gameFunction("renderOpponentHabits"), context);
  context.renderOpponentHabits();
  const markup = context.ui.opponentHabits.innerHTML;
  assert.match(markup, /CARD CHOICE/);
  assert.match(markup, /LANE PLACEMENT/);
  assert.match(markup, /CARD COUNT/);
  assert.match(markup, /Favoured lanes 1 and 2; a habit, not this round's formation/);
  assert.equal((markup.match(/class="is-favoured"/g) || []).length, 2);
  context.state.aiPlan = shape(3);
  context.renderOpponentHabits();
  assert.equal(context.ui.opponentHabits.innerHTML, markup);
  context.state.difficulty = "blind";
  context.renderOpponentHabits();
  assert.equal(context.ui.opponentHabits.hidden, true);
  assert.equal(context.ui.opponentHabits.innerHTML, "");
  context.state.gameMode = "normal"; context.state.difficulty = "instinct";
  context.state.aiTraits = normal.createAiTraits(() => .1);
  context.renderOpponentHabits();
  assert.doesNotMatch(context.ui.opponentHabits.innerHTML, /habit-lane-map|opponent-habit-category|LANE PLACEMENT/);
});

test("history lane observations require two completed partial WIP rounds and never read hidden traits", () => {
  const context = {};
  runInNewContext(gameFunction("historyPlacementSummaryMarkup"), context);
  const partial = mask => ({ mode: "four-lane", aiCards: shape(mask) });
  assert.equal(context.historyPlacementSummaryMarkup([]), "");
  assert.equal(context.historyPlacementSummaryMarkup([partial(3)]), "");
  assert.equal(context.historyPlacementSummaryMarkup([partial(15), { mode: "normal", aiCards: shape(3) }, partial(3)]), "");
  const entries = [partial(12), ...Array.from({ length: 8 }, () => partial(3)), partial(15),
    { mode: "normal", aiCards: shape(12) }, { mode: "four-lane", aiCards: [] }];
  const before = JSON.stringify(entries), markup = context.historyPlacementSummaryMarkup(entries);
  assert.match(markup, /Last 8 completed 1–3-card plays/);
  assert.match(markup, /Lane 1: occupied in 8 of 8 plays/);
  assert.match(markup, /Lane 2: occupied in 8 of 8 plays/);
  assert.match(markup, /Lane 3: occupied in 0 of 8 plays/);
  assert.match(markup, /Lane 4: occupied in 0 of 8 plays/);
  const poisoned = entries.map(entry => ({ ...entry, aiTraits: new Proxy({}, { get() { throw new Error("hidden traits read"); } }),
    aiPlan: new Proxy({}, { get() { throw new Error("current plan read"); } }) }));
  assert.equal(context.historyPlacementSummaryMarkup(poisoned), markup);
  assert.equal(JSON.stringify(entries), before);
  assert.doesNotMatch(markup, /Left Flank|Right Flank|Centre Guard|Outer Guard|favoured|preferred/i);
});
