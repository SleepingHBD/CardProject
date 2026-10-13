import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import "../src/rules.js";
import "../src/four-lane-rules.js";
import "../src/deckbuilding.js";
import "../src/opponents.js";

const decks = globalThis.ClawDeckbuilding, opponents = globalThis.ClawFourLaneOpponents;
const source = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const opponentsSource = readFileSync(new URL("../src/opponents.js", import.meta.url), "utf8");
const library = runInNewContext([
  source.slice(source.indexOf("const CARD_LIBRARY ="), source.indexOf("const HAND_SIZE =")),
  source.slice(source.indexOf("const FOUR_LANE_RALLY_CARDS ="), source.indexOf("const DIFFICULTIES =")),
  "[...CARD_LIBRARY, ...FOUR_LANE_CARDS]",
].join("\n"));
const catalog = decks.createCardCatalog(library), starters = decks.createStarterPresets(catalog);
const roster = opponents.createRoster(catalog);
function gameFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1);
  return source.slice(start, source.indexOf("\n}", start) + 2);
}

test("four rivals retain distinct legal decks, transparent costs and no exclusive stats", () => {
  assert.equal(roster.length, 4);
  assert.equal(new Set(roster.map(rival => JSON.stringify(rival.deck.cards))).size, 4);
  assert.deepEqual(roster.map(rival => rival.name), ["Versatile Duelist", "Banner Captain", "Cycle Weaver", "Twilight Duelist"]);
  for (const rival of roster) {
    const report = decks.validateDeck(catalog, rival.deck);
    assert.ok(report.valid);
    assert.equal(report.summary.count, 24);
    assert.ok(report.summary.totalCost <= 120);
    assert.deepEqual(Object.values(report.summary.elementCounts), [8, 8, 8]);
    assert.equal(rival.deck, starters.find(deck => deck.id === rival.deckId));
    assert.ok(Object.isFrozen(rival) && Object.isFrozen(rival.deck.cards));
    assert.equal(Object.hasOwn(rival, "habits"), false);
    const cards = decks.buildDeckInstances(catalog, rival.deck, "opponent");
    assert.ok(cards.every(card => card.power === catalog.byKey[card.art].power));
  }
  const counts = id => decks.validateDeck(catalog, roster.find(rival => rival.id === id).deck).summary.roleCounts;
  assert.deepEqual(counts("balanced"), { vanguard: 7, link: 6, finisher: 6, rally: 5 });
  assert.equal(counts("rally").rally, 11);
  assert.equal(counts("link").link, 8);
  assert.equal(counts("finisher").finisher, 8);
  assert.ok(roster.every(rival => Object.values(counts(rival.id)).every(count => count > 0)));
});

test("random selection consumes exactly one roll; named rivals consume none", () => {
  for (const [roll, id] of [[-1, "balanced"], [0, "balanced"], [.25, "rally"], [.5, "link"], [.75, "finisher"], [1, "finisher"]]) {
    let calls = 0;
    const encounter = opponents.createEncounter(roster, "random", () => { calls++; return roll; });
    assert.equal(encounter.profile.id, id);
    assert.equal(calls, 1, "only the rival is randomized, not a hidden personality");
    assert.deepEqual(encounter.traits, []);
  }
  for (const rival of roster) {
    const encounter = opponents.createEncounter(roster, rival.id, () => { throw Error("Unexpected personality roll"); });
    assert.equal(encounter.profile, rival);
    assert.equal(encounter.deck, rival.deck);
    assert.deepEqual(encounter.traits, []);
  }
});

test("selection rejects forged rosters, unknown profiles and non-finite random rolls", () => {
  for (const id of ["__proto__", "constructor", "no-such-rival", {}, null]) {
    assert.throws(() => opponents.createEncounter(roster, id), RangeError);
  }
  assert.throws(() => opponents.createEncounter([...roster], "balanced"), TypeError);
  for (const roll of [NaN, Infinity, -Infinity, undefined, "0", null]) {
    assert.throws(() => opponents.createEncounter(roster, "random", () => roll), TypeError);
  }
  assert.throws(() => opponents.createRoster(decks.createCardCatalog(library.slice(0, 10))), /Invalid starter deck/);
});

test("encounter snapshots are immutable and do not contain or generate habits", () => {
  for (const rival of roster) {
    const encounter = opponents.createEncounter(roster, rival.id);
    assert.ok(Object.isFrozen(encounter) && Object.isFrozen(encounter.traits));
    assert.deepEqual(Object.keys(encounter).sort(), ["deck", "profile", "traits"]);
    assert.deepEqual(encounter.traits, []);
    assert.throws(() => encounter.traits.push({ id: "power-seeker" }), TypeError);
    assert.throws(() => { encounter.deck = starters[0]; }, TypeError);
    assert.doesNotMatch(JSON.stringify(encounter), /habits|preferredLanes|commitment|motive/);
  }
  assert.doesNotMatch(opponentsSource, /createAiTraits|AI_MOTIVE_TRAITS|AI_PLACEMENT_TRAITS|AI_COMMITMENT_TRAITS/);
  const sandbox = { ClawDeckbuilding: decks };
  runInNewContext(opponentsSource, sandbox);
  const isolatedRoster = sandbox.ClawFourLaneOpponents.createRoster(catalog);
  assert.equal(isolatedRoster.length, 4);
  assert.equal(sandbox.ClawFourLaneOpponents.createEncounter(isolatedRoster, "balanced").traits.length, 0);
});

test("rival descriptions advertise deck strengths rather than hidden scripted personalities", () => {
  for (const rival of roster) {
    assert.ok(rival.description.length >= 100 && rival.description.length <= 180);
    assert.doesNotMatch(rival.description, /habits|difficulty|Blind|Instinct|always|6 trophies|completed elements/i);
    assert.ok(rival.theme && rival.name);
  }
  assert.match(roster[0].description, /all four roles.*shared lane/);
  assert.match(roster[1].description, /Rally partnerships and Vanguard openers.*shared battle lane/);
  assert.match(roster[2].description, /Link and mixed elements.*complete elemental sets/);
  assert.match(roster[3].description, /rightmost threat.*compact formation or a wider attack/);
});

test("WIP always shows its rival identity and scrubs habitual clues left by Normal Play", () => {
  const info = {}, habits = {};
  const context = { document: { querySelector: () => info },
    state: { gameMode: "four-lane", difficulty: "open",
      aiTraits: [{ id: "stale-habit", label: "Stale habit", description: "Must not appear" }] },
    matchFourLaneOpponent: opponents.createEncounter(roster, "link"),
    ui: { opponentHabits: habits }, isFourLaneMode: () => context.state.gameMode === "four-lane" };
  runInNewContext([gameFunction("renderFourLaneRivalInfo"), gameFunction("renderOpponentHabits")].join("\n"), context);
  for (const difficulty of ["open", "guided", "instinct", "blind"]) {
    context.state.difficulty = difficulty;
    context.renderFourLaneRivalInfo(); context.renderOpponentHabits();
    assert.equal(info.hidden, false);
    assert.match(info.textContent, /Cycle Weaver · Element Weavers/);
    assert.equal(habits.hidden, true);
    assert.equal(habits.innerHTML, "");
  }
  context.state.gameMode = "normal";
  context.state.difficulty = "instinct";
  context.renderFourLaneRivalInfo(); context.renderOpponentHabits();
  assert.equal(info.hidden, true);
  assert.equal(info.textContent, "");
  assert.equal(habits.hidden, false);
  assert.match(habits.innerHTML, /Stale habit/);
});

test("rival selection is accessible, packaged before the game and separate from Normal Play", () => {
  assert.match(page, /<fieldset[^>]*id="fourLaneRivalChoice"[^>]*aria-describedby="fourLaneRivalHelp"/);
  assert.match(source, /type="radio" name="fourLaneRival"/);
  assert.ok(page.indexOf("./src/deckbuilding.js") < page.indexOf("./src/opponents.js"));
  assert.ok(page.indexOf("./src/opponents.js") < page.indexOf("./src/game.js"));
  const packaging = readFileSync(new URL("../scripts/copy-static.js", import.meta.url), "utf8");
  assert.ok(packaging.includes('cp("src/opponents.js", "dist/src/opponents.js")'));
  const start = source.indexOf("function freshDeck(");
  const freshDeck = source.slice(start, source.indexOf("\n}", start) + 2);
  assert.doesNotMatch(freshDeck, /ClawDeckbuilding|fourLaneOpponent|FOUR_LANE_CARDS/);
  assert.match(source, /let selectedFourLaneOpponent = "random"/);
});
