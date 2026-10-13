import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { catalog, createAuditDecks, policies, roster, simulateDuel } from "../scripts/audit-deckbuilding.js";

const api = globalThis.ClawDeckbuilding;
const probes = createAuditDecks();

test("balance probes are reproducible legal decks, including 16/4/4 and each omitted role", () => {
  assert.equal(probes.length, 17);
  assert.deepEqual(createAuditDecks(), probes);
  assert.ok(Object.isFrozen(probes));
  for (const definition of probes) assert.ok(api.validateDeck(catalog, definition).valid, definition.id);
  for (const element of api.ELEMENTS) {
    const counts = api.validateDeck(catalog, probes.find(deck => deck.id === `heavy-${element}`)).summary.elementCounts;
    assert.equal(counts[element], 16);
    assert.ok(Object.entries(counts).filter(([key]) => key !== element).every(([, count]) => count === 4));
  }
  for (const role of api.ROLES) assert.equal(api.validateDeck(catalog, probes.find(deck => deck.id === `no-${role}`)).summary.roleCounts[role], 0);
  assert.ok(api.validateDeck(catalog, probes.find(deck => deck.id === "low-cost")).summary.totalCost <= 100);
});

test("612 varied-deck public-hand probes finish at round eight with legal shared-lane play", t => {
  let matches = 0, reshuffles = 0;
  const wins = Object.fromEntries(policies.map(policy => [policy, 0]));
  const activations = { vanguard: 0, link: 0, finisher: 0, rally: 0 };
  for (const [deckIndex, deck] of probes.entries()) for (const [rivalIndex, rival] of roster.entries()) for (const policy of policies) {
    const result = simulateDuel(deck, rival.id, policy, 24519 + deckIndex * 1000003 + rivalIndex * 100003);
    assert.notEqual(result.winner, "stalled", `${deck.id}/${rival.id}/${policy}`);
    assert.equal(result.rounds, 8);
    assert.equal(result.roundLimitDraw, false, "a final-score tie is not a timeout draw");
    assert.equal(result.winner, result.scores[0] === result.scores[1] ? "draw"
      : result.scores[0] > result.scores[1] ? "player" : "opponent");
    for (let side = 0; side < 2; side++) {
      assert.equal(result.scores[side], result.trophies[side] + 2 * result.sets[side]);
    }
    assert.equal(result.counts[0].reduce((a, b) => a + b), result.rounds);
    assert.equal(result.counts[1].reduce((a, b) => a + b), result.rounds);
    if (policy === "one") assert.equal(result.counts[0][0], result.rounds);
    if (policy === "two") assert.equal(result.counts[0][1], result.rounds);
    wins[policy] += Number(result.winner === "player");
    reshuffles += result.reshuffles;
    for (const role of api.ROLES) activations[role] += result.activations[role];
    matches++;
  }
  assert.equal(matches, 612);
  assert.ok(reshuffles > 0 && Object.values(activations).every(count => count > 0));
  // Report strategy observations, without asserting an obsolete metagame or
  // treating this fixed heuristic cohort as a universal balance proof.
  t.diagnostic(`Player wins in 68 paired matches per policy: ${JSON.stringify(wins)}`);
});

test("the same duel seed reproduces choices and outcomes without mutating a custom definition", () => {
  const definition = probes.find(deck => deck.id === "no-link"), before = JSON.stringify(definition);
  const { maxPlanningMs: firstTime, ...first } = simulateDuel(definition, "link", "cycle-4-1-1", 79191);
  const { maxPlanningMs: secondTime, ...second } = simulateDuel(definition, "link", "cycle-4-1-1", 79191);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(definition), before);
  assert.ok(firstTime >= 0 && secondTime >= 0);
});

test("Last Light retains its identity and legal budget while improving support lanes, not card stats", () => {
  const preset = api.createStarterPresets(catalog).find(deck => deck.id === "finisher");
  const report = api.validateDeck(catalog, preset);
  assert.equal(report.summary.totalCost, 120);
  assert.equal(report.summary.rarityCounts.legendary, 0);
  assert.deepEqual(report.summary.elementCounts, { ember: 8, gust: 8, tide: 8 });
  assert.deepEqual(report.summary.roleCounts, { vanguard: 5, link: 5, finisher: 8, rally: 6 });
  assert.equal(preset.cards.reduce((sum, key) => sum + catalog.byKey[key].power, 0), 117);
  assert.equal(report.summary.copies["beacon-burmilla"], 2);
  assert.equal(report.summary.copies["isai-tidebind"], 2);
});

test("deck tips are non-blocking, use one consistent budget and do not imply omitted roles are invalid", () => {
  const low = probes.find(deck => deck.id === "low-cost"), skew = probes.find(deck => deck.id === "heavy-ember");
  assert.match(api.getDeckTips(catalog, low).join(" "), /30 cost unused/);
  assert.match(api.getDeckTips(catalog, skew).join(" "), /Only 4 Gust cards and 4 Water cards/);
  const finisherHeavy = { ...low, cards: api.ELEMENTS.flatMap(element => {
    const options = catalog.cards.filter(card => card.element === element)
      .flatMap(card => Array(card.copyLimit).fill(card))
      .sort((a, b) => Number(b.tactic === "finisher" && b.cost <= 6) - Number(a.tactic === "finisher" && a.cost <= 6) || a.cost - b.cost);
    return options.slice(0, 8).map(card => card.key);
  }) };
  assert.ok(api.validateDeck(catalog, finisherHeavy).valid);
  assert.ok(api.validateDeck(catalog, finisherHeavy).summary.roleCounts.finisher > 8);
  assert.match(api.getDeckTips(catalog, finisherHeavy).join(" "), /Only the rightmost Finisher.*at least two cards/);
  for (const role of api.ROLES) {
    const deck = probes.find(value => value.id === `no-${role}`);
    const before = JSON.stringify(deck);
    const tips = api.getDeckTips(catalog, deck);
    assert.ok(Object.isFrozen(tips));
    assert.doesNotMatch(tips.join(" "), /must include.*role|missing.*role/i);
    assert.ok(api.validateDeck(catalog, deck).valid);
    assert.equal(JSON.stringify(deck), before);
  }
  assert.deepEqual(api.getDeckTips(catalog, { ...low, cards: [] }), []);
});

test("lobby choices precede launch, the gallery is optional, and tips never disable saving", () => {
  const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const editor = readFileSync(new URL("../src/deck-editor.js", import.meta.url), "utf8");
  assert.ok(page.indexOf('id="fourLaneDeckChoiceTitle"') < page.indexOf('id="fourLaneRivalChoice"'));
  assert.ok(page.indexOf('id="fourLaneRivalChoice"') < page.indexOf('id="fourLaneStartButton"'));
  assert.match(page, /<details class="four-lane-card-disclosure">/);
  assert.match(page, /Deck tips \(optional\)/);
  assert.match(editor, /deckEditorSaveButton\.disabled = !report\.valid/);
  assert.doesNotMatch(editor, /disabled = .*tips/);
  assert.match(editor, /item\.textContent = text/);
});

test("existing saved custom lists survive starter rebalancing without silent substitutions", () => {
  const old = { version: 1, name: "My earlier Last Light", cards: [
    "comet-claw", "toastie-toe-beans", "flaskfoot-felix", "flaskfoot-felix", "cinder-kit", "cinder-kit", "teapot-tabby", "teapot-tabby",
    "leafy-loaf", "belfry-bobtail", "dandelion-dash", "dandelion-dash", "kitewhisker", "kitewhisker", "windlass-whiskers", "windlass-whiskers",
    "empress-ebb", "isai-tidebind", "mizzle-motley", "mizzle-motley", "wellwater-wisp", "wellwater-wisp", "rivertow-ragdoll", "rivertow-ragdoll",
  ] };
  let raw;
  const storage = { getItem: () => raw, setItem: (_, value) => { raw = value; } };
  const store = api.createDeckStore(catalog, storage), saved = store.save(old);
  const reloaded = api.createDeckStore(catalog, storage).getDeck(saved.id);
  assert.deepEqual(reloaded.cards, old.cards);
  assert.notDeepEqual(reloaded.cards, roster[3].deck.cards);
});
