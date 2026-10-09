import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import "../src/rules.js";
import "../src/four-lane-rules.js";
import "../src/deckbuilding.js";

const decks = globalThis.ClawDeckbuilding, normal = globalThis.ClawRules, four = globalThis.ClawFourLaneRules;
const gameSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const library = runInNewContext([
  gameSource.slice(gameSource.indexOf("const CARD_LIBRARY ="), gameSource.indexOf("const HAND_SIZE =")),
  gameSource.slice(gameSource.indexOf("const FOUR_LANE_RALLY_CARDS ="), gameSource.indexOf("const DIFFICULTIES =")),
  "[...CARD_LIBRARY, ...FOUR_LANE_CARDS]",
].join("\n"));
const catalog = decks.createCardCatalog(library);
const presets = decks.createStarterPresets(catalog);
const definition = (cards, extra = {}) => ({ version: 1, name: "Test deck", cards, ...extra });
const codes = value => decks.validateDeck(catalog, value).errors.map(error => error.code);
const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);

test("Phase 1 construction limits are explicit, immutable and independent of combat rules", () => {
  assert.equal(decks.DECK_SIZE, 24);
  assert.equal(decks.MAX_DECK_COST, 120);
  assert.equal(decks.MIN_CARDS_PER_ELEMENT, 4);
  assert.deepEqual(decks.COPY_LIMITS, { common: 2, uncommon: 2, rare: 1, epic: 1, legendary: 1 });
  assert.ok(Object.isFrozen(decks) && Object.isFrozen(decks.COPY_LIMITS) && Object.isFrozen(decks.RARITY_COST_BONUS));
  assert.equal(four.HAND_SIZE, 7);
  assert.equal(four.MAX_COMMITMENT, 4);
  assert.equal(four.ROUND_DRAW, 3);
  assert.equal(four.MAX_EXTRA_CARD_POINTS, 2);
  assert.equal(normal.LANE_WIN_POINTS, 2);
});

test("the canonical catalog covers all 36 cards and does not mutate or retain writable templates", () => {
  const before = JSON.stringify(library);
  const built = decks.createCardCatalog(library);
  assert.equal(built.cards.length, 36);
  assert.equal(new Set(built.cards.map(card => card.key)).size, 36);
  assert.equal(Object.getPrototypeOf(built.byKey), null);
  assert.ok(Object.isFrozen(built) && Object.isFrozen(built.byKey) && Object.isFrozen(built.cards));
  assert.ok(built.cards.every(Object.isFrozen));
  assert.throws(() => { built.cards[0].power = 99; }, TypeError);
  assert.throws(() => { built.byKey["cinder-kit"] = {}; }, TypeError);
  for (const card of built.cards) {
    assert.equal(card.key, card.art);
    assert.equal(card.cost, card.power + decks.RARITY_COST_BONUS[card.rarity]);
    assert.equal(card.copyLimit, decks.COPY_LIMITS[card.rarity]);
    assert.equal(card.instanceId, undefined);
  }
  assert.equal(JSON.stringify(library), before);
  assert.notEqual(built.cards[0], library[0]);
  const photo = built.byKey["aakith-wayfinder"];
  assert.equal(photo.name, "Aakith");
  assert.equal(photo.artworkSource, "./assets/cards/four-lane/aakith-wayfinder.png");
});

test("bad canonical definitions, duplicate keys, sparse catalogs and constructed lookalikes fail closed", () => {
  for (const value of [null, {}, [], new Array(2), new Array(257).fill(library[0])]) {
    assert.throws(() => decks.createCardCatalog(value), TypeError);
  }
  for (const changed of [
    { art: "__proto__" }, { art: "../cinder-kit" }, { art: "<script>" }, { art: "Aakith" },
    { element: "fire" }, { tactic: "none" }, { rarity: "__proto__" }, { rarity: new String("common") }, { power: 10 }, { power: 0 },
    { power: NaN }, { power: 4.5 }, { name: " " },
  ]) assert.throws(() => decks.createCardCatalog([{ ...library[0], ...changed }]), TypeError);
  assert.throws(() => decks.createCardCatalog([library[0], library[0]]), /Duplicate card key/);
  assert.throws(() => decks.validateDeck({ ...catalog }, presets[0]), TypeError);
  assert.throws(() => decks.validateDeck(null, presets[0]), TypeError);
});

test("starter decks are legal, distinct and preserve optional roles", () => {
  assert.equal(presets.length, 4);
  assert.equal(new Set(presets.map(preset => preset.cards.slice().sort().join(","))).size, 4);
  const expectedCosts = [119, 119, 120, 120];
  const expectedRoles = [
    { vanguard: 7, link: 6, finisher: 6, rally: 5 },
    { vanguard: 7, link: 2, finisher: 4, rally: 11 },
    { vanguard: 5, link: 8, finisher: 4, rally: 7 },
    { vanguard: 5, link: 5, finisher: 8, rally: 6 },
  ];
  presets.forEach((preset, index) => {
    const report = decks.validateDeck(catalog, preset);
    assert.ok(report.valid, JSON.stringify(report.errors));
    assert.equal(report.summary.count, 24);
    assert.equal(report.summary.totalCost, expectedCosts[index]);
    assert.deepEqual(report.summary.elementCounts, { ember: 8, gust: 8, tide: 8 });
    assert.deepEqual(report.summary.roleCounts, expectedRoles[index]);
    assert.ok(Object.isFrozen(preset) && Object.isFrozen(preset.cards));
    assert.ok(Object.isFrozen(report) && Object.isFrozen(report.errors) && Object.isFrozen(report.summary));
    assert.ok(Object.values(report.summary).filter(value => typeof value === "object").every(Object.isFrozen));
  });
  assert.equal(decks.createStarterPresets(catalog), presets);
  assert.throws(() => decks.createStarterPresets(decks.createCardCatalog(library.slice(0, 24))), /Invalid starter deck/);
});

test("save-shaped deck definitions survive JSON, renames, reordered catalogs and changed ordinal IDs", () => {
  const stored = JSON.parse(JSON.stringify(presets[0]));
  const reordered = library.slice().reverse().map((card, index) => ({ ...card, id: `new-${index}`, name: `${card.name} renamed` }));
  const rebuilt = decks.createCardCatalog(reordered);
  assert.deepEqual(decks.validateDeck(rebuilt, stored).summary, decks.validateDeck(catalog, stored).summary);
  assert.ok(decks.validateDeck(rebuilt, stored).valid);
  assert.equal(decks.buildDeckInstances(rebuilt, stored, "player")[0].name, "Toastie Toe Beans renamed");
  assert.equal(decks.buildDeckInstances(rebuilt, stored, "player")[0].templateId, "toastie-toe-beans");
});

test("exact deck size is enforced independently of the budget", () => {
  assert.ok(codes(definition(presets[0].cards.slice(1))).includes("deck-size"));
  assert.ok(codes(definition([...presets[0].cards, "teapot-tabby"])).includes("deck-size"));
  assert.ok(codes(definition([])).includes("deck-size"));
  assert.equal(decks.validateDeck(catalog, presets[2]).summary.totalCost, 120);
  const costly = presets[0].cards.slice();
  costly[costly.indexOf("cinder-kit")] = "comet-claw";
  const report = decks.validateDeck(catalog, definition(costly));
  assert.equal(report.summary.count, 24);
  assert.equal(report.summary.totalCost, 130);
  assert.ok(report.errors.some(error => error.code === "over-budget"));
  assert.ok(report.errors.every(error => error.code !== "deck-size"));
});

test("every rarity copy limit is enforced, including low-cost duplicate abuse", () => {
  for (const rarity of Object.keys(decks.COPY_LIMITS)) {
    const card = catalog.cards.find(value => value.rarity === rarity);
    const validCopies = new Array(card.copyLimit).fill(card.key);
    assert.ok(!codes(definition(validCopies)).includes("copy-limit"));
    const report = decks.validateDeck(catalog, definition([...validCopies, card.key]));
    assert.ok(report.errors.some(error => error.code === "copy-limit" && error.key === card.key));
  }
  const copies = new Array(24).fill("teapot-tabby");
  assert.equal(decks.validateDeck(catalog, definition(copies)).summary.totalCost, 72);
  assert.ok(codes(definition(copies)).includes("copy-limit"));
});

test("four of each element is a minimum, not a forced eight/eight/eight split", () => {
  const keys = catalog.cards.filter(card => card.rarity === "common").flatMap(card => [card.key, card.key]);
  assert.ok(decks.validateDeck(catalog, definition(keys)).valid);
  assert.equal(decks.validateDeck(catalog, definition(keys)).summary.totalCost, 90);
  const biased = [...keys.filter(key => catalog.byKey[key].element === "ember"),
    ...keys.filter(key => catalog.byKey[key].element === "gust").slice(0, 4),
    ...keys.filter(key => catalog.byKey[key].element === "tide").slice(0, 4),
    ...catalog.cards.filter(card => card.rarity === "uncommon").flatMap(card => [card.key, card.key]).slice(0, 8)];
  const report = decks.validateDeck(catalog, definition(biased));
  assert.ok(report.valid, JSON.stringify(report.errors));
  assert.deepEqual(report.summary.elementCounts, { ember: 12, gust: 8, tide: 4 });
  const missing = biased.map(key => catalog.byKey[key].element === "tide" ? "teapot-tabby" : key);
  assert.ok(codes(definition(missing)).includes("element-minimum"));
});

test("a deck can omit Vanguard, or any other role, with no hidden role quotas", () => {
  const noVanguard = catalog.cards.filter(card => card.rarity === "common" && card.tactic !== "vanguard")
    .flatMap(card => [card.key, card.key]);
  noVanguard.push(...catalog.cards.filter(card => card.rarity === "uncommon" && card.tactic === "rally")
    .flatMap(card => [card.key, card.key]));
  const report = decks.validateDeck(catalog, definition(noVanguard));
  assert.ok(report.valid, JSON.stringify(report.errors));
  assert.equal(report.summary.roleCounts.vanguard, 0);
  for (const role of decks.ROLES) {
    const pool = catalog.cards.filter(card => card.tactic !== role).flatMap(card => Array(card.copyLimit).fill(card))
      .sort((a, b) => a.cost - b.cost);
    const chosen = decks.ELEMENTS.flatMap(element => pool.filter(card => card.element === element).slice(0, 8));
    const omitted = decks.validateDeck(catalog, definition(chosen.map(card => card.key)));
    assert.ok(omitted.valid); assert.equal(omitted.summary.roleCounts[role], 0);
  }
});

test("the current cost budget rules out all three Legendaries even with the cheapest legal fillers", () => {
  const legends = catalog.cards.filter(card => card.rarity === "legendary");
  const cheapestFillers = catalog.cards.filter(card => card.rarity !== "legendary")
    .flatMap(card => new Array(card.copyLimit).fill(card)).sort((a, b) => a.cost - b.cost).slice(0, 21);
  assert.equal(legends.length, 3);
  const cost = [...legends, ...cheapestFillers].reduce((sum, card) => sum + card.cost, 0);
  assert.equal(cost, 123);
  assert.ok(cost > decks.MAX_DECK_COST);
  assert.ok(codes(definition([...legends, ...cheapestFillers].map(card => card.key))).includes("over-budget"));
});

test("every card in the collection can appear in a legal deck, including premium Rally cards", () => {
  const commons = catalog.cards.filter(card => card.rarity === "common").flatMap(card => [card.key, card.key]);
  for (const card of catalog.cards) {
    const keys = commons.slice();
    if (!keys.includes(card.key)) {
      keys[keys.findIndex(key => catalog.byKey[key].element === card.element)] = card.key;
    }
    const report = decks.validateDeck(catalog, definition(keys));
    assert.ok(report.valid, `${card.name}: ${JSON.stringify(report.errors)}`);
    assert.ok(keys.includes(card.key));
  }
});

test("seeded varied lists preserve exact composition through validation, JSON and runtime construction", () => {
  const random = rng(7007);
  let accepted = 0, rejected = 0;
  for (let trial = 0; trial < 512; trial++) {
    const pool = catalog.cards.flatMap(card => new Array(card.copyLimit).fill(card.key));
    const keys = [];
    while (keys.length < 24) keys.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    const saved = JSON.parse(JSON.stringify(definition(keys)));
    const report = decks.validateDeck(catalog, saved);
    assert.equal(report.summary.count, 24);
    assert.equal(report.summary.totalCost, keys.reduce((sum, key) => sum + catalog.byKey[key].cost, 0));
    assert.ok(!report.errors.some(error => error.code === "copy-limit"));
    if (report.valid) {
      accepted++;
      const built = decks.buildDeckInstances(catalog, saved, "player");
      assert.deepEqual(built.map(card => card.templateId), keys);
      assert.equal(new Set(built.map(card => card.instanceId)).size, 24);
    } else {
      rejected++;
      assert.throws(() => decks.buildDeckInstances(catalog, saved, "player"), RangeError);
    }
  }
  assert.ok(accepted > 0 && rejected > 0);
});

test("malformed imports, forged card stats, prototype keys and pathological input are rejected", () => {
  for (const value of [null, undefined, "deck", [], 12]) assert.ok(codes(value).includes("invalid-definition"));
  for (const version of [undefined, 0, 2, "1"]) assert.ok(codes({ ...presets[0], version }).includes("unsupported-version"));
  for (const name of [undefined, 7, " ", "x".repeat(49)]) assert.ok(codes({ ...presets[0], name }).includes("invalid-name"));
  for (const cards of [undefined, "teapot-tabby", {}, new Array(24)]) {
    assert.ok(!decks.validateDeck(catalog, definition(cards)).valid);
  }
  assert.ok(codes(Object.create(presets[0])).includes("invalid-cards"));
  for (const fake of ["__proto__", "constructor", "toString", "../../card", "card-0", null,
    { art: "cinder-kit", power: 99, cost: 0 }]) {
    const cards = presets[0].cards.slice(); cards[0] = fake;
    assert.ok(codes(definition(cards)).includes("unknown-card"));
  }
  const enormous = decks.validateDeck(catalog, definition(new Array(1_000_000)));
  assert.equal(enormous.summary.count, 1_000_000);
  assert.equal(enormous.errors.length, 1);
  assert.equal(enormous.errors[0].code, "input-too-large");
  const forgedMetadata = { ...presets[0], power: 999, cost: 0, elementCounts: { ember: 24 } };
  assert.equal(decks.validateDeck(catalog, forgedMetadata).summary.totalCost, 119);
  assert.equal(decks.buildDeckInstances(catalog, forgedMetadata, "player")[0].power, 5);
});

test("runtime instances preserve canonical Power, isolate owners/copies/builds, and never mutate definitions", () => {
  const saved = JSON.parse(JSON.stringify(presets[0]));
  const before = JSON.stringify(saved);
  const built = [decks.buildDeckInstances(catalog, saved, "player"), decks.buildDeckInstances(catalog, saved, "opponent"),
    decks.buildDeckInstances(catalog, saved, "player")];
  assert.equal(new Set(built.flat().map(card => card.instanceId)).size, 72);
  assert.notEqual(built[0][0], built[0][1]);
  const matchingCopy = built[0].find((card, index) => index > 0 && card.templateId === built[0][0].templateId);
  assert.ok(matchingCopy);
  assert.ok(built[0].every(card => card.instanceId.startsWith("player-")));
  assert.ok(built[1].every(card => card.instanceId.startsWith("opponent-")));
  for (const card of built.flat()) {
    assert.equal(card.power, catalog.byKey[card.templateId].power);
    assert.equal(card.tactic, catalog.byKey[card.templateId].tactic);
  }
  built[0][0].power = 99;
  assert.equal(matchingCopy.power, 5);
  assert.equal(built[2][0].power, 5);
  assert.equal(catalog.byKey["cinder-kit"].power, 4);
  assert.equal(JSON.stringify(saved), before);
  assert.throws(() => decks.buildDeckInstances(catalog, definition([]), "player"), RangeError);
  for (const owner of [undefined, "ai", "../player", {}]) {
    assert.throws(() => decks.buildDeckInstances(catalog, saved, owner), TypeError);
  }
});

test("runtime deck cost has no effect on lane Power, role bonuses or Rally", () => {
  const own = [catalog.byKey["sir-squall"], catalog.byKey["lucan-cinderclay"]];
  const enemy = [{ element: "gust", power: 9, tactic: "vanguard" }];
  const result = four.resolveClashes(own, enemy);
  assert.equal(own[0].cost, 15);
  assert.equal(result.lanes[0].player.total, 11);
  assert.equal(result.lanes[0].ai.total, 10);
  assert.equal(result.winner, "player");
});

function simulateMatch(playerPreset, opponentPreset, seed, traits = []) {
  const owners = ["player", "opponent"];
  const sides = [playerPreset, opponentPreset].map((preset, index) => {
    const random = rng(seed + index * 8191), deck = [];
    const discard = decks.buildDeckInstances(catalog, preset, owners[index]);
    normal.reshuffleDiscardPile(deck, discard, random);
    const side = { deck, discard, hand: [], progress: four.createProgress(), random };
    four.replenishHand(deck, discard, side.hand, 7, random);
    return side;
  });
  const decisions = [rng(seed + 31001), rng(seed + 41001)], history = [];
  const traitsBefore = JSON.stringify(traits);
  let reshuffles = 0;
  for (let round = 0; round < 150; round++) {
    const reversedHistory = history.map(value => ({ playerCards: value.aiCards, aiCards: value.playerCards, laneProgress: { player: value.laneProgress?.ai, ai: value.laneProgress?.player } }));
    // Public card collection only. Never pass the opposing preset, deck or hand.
    const plays = [
      four.chooseAiFormation(sides[0].hand, sides[1].progress, sides[0].progress, decisions[0], [],
        { history: reversedHistory, cardLibrary: library }),
      four.chooseAiFormation(sides[1].hand, sides[0].progress, sides[1].progress, decisions[1], traits,
        { history, cardLibrary: library }),
    ];
    const opposingCommitted = plays[1].filter(Boolean);
    const strongest = Math.max(...opposingCommitted.map(card => card.power));
    if (traits.some(trait => trait.id === "strong-opener")) assert.equal(plays[1][0].power, strongest);
    if (traits.some(trait => trait.id === "late-striker")) assert.equal(opposingCommitted.at(-1).power, strongest);
    const result = four.resolveProgress(...plays, sides[0].progress, sides[1].progress);
    assert.ok(result.extraCardPoints.player <= Math.min(2, result.laneWins.player));
    assert.ok(result.extraCardPoints.ai <= Math.min(2, result.laneWins.ai));

    sides.forEach((side, index) => {
      const committed = plays[index].filter(Boolean);
      assert.equal(plays[index].length, 4);
      assert.ok(committed.length >= 1 && committed.length <= 4);
      assert.equal(new Set(committed).size, committed.length);
      assert.ok(committed.every(card => side.hand.includes(card)));
      side.hand = side.hand.filter(card => !committed.includes(card));
      side.discard.push(...committed);
      side.progress = { ...result.progressAfter[(index === 0 ? "player" : "ai")] };

      const all = [...side.deck, ...side.discard, ...side.hand];
      assert.equal(all.length, 24);
      assert.equal(new Set(all.map(card => card.instanceId)).size, 24);
      assert.ok(all.every(card => card.instanceId.startsWith(`${owners[index]}-`)));

    });
    const snapshot = cards => cards.map(card => card
      ? { element: card.element, power: card.power, tactic: card.tactic, art: card.art } : null);
    history.push({ playerCards: snapshot(plays[0]), aiCards: snapshot(plays[1]), laneProgress: result.laneProgress });
    assert.equal(JSON.stringify(traits), traitsBefore);
    if (sides.some(side => four.getProgressTotal(side.progress) === 18)) return { rounds: round + 1, reshuffles };
    sides.forEach(side => {
      reshuffles += Number(four.replenishHand(side.deck, side.discard, side.hand, four.ROUND_DRAW, side.random).reshuffled);
      assert.ok(side.hand.length >= 1 && side.hand.length <= 7);
    });
  }
  assert.fail(`Match did not finish: ${playerPreset.id}/${opponentPreset.id}, seed ${seed}`);
}

test("all starter matchups complete with 24-card recycling and no card removed as a trophy", () => {
  let matches = 0, reshuffles = 0;
  for (const player of presets) for (const opponent of presets) for (let trial = 0; trial < 4; trial++) {
    const result = simulateMatch(player, opponent, 1100 + matches * 131);
    matches++; reshuffles += result.reshuffles;
  }
  assert.equal(matches, 64);
  assert.ok(reshuffles > 0);
});

test("all 144 WIP habit profiles function across the four starter decks without private opposing deck access", () => {
  let matches = 0;
  for (const motive of normal.AI_MOTIVE_TRAITS) for (const placement of four.AI_PLACEMENT_TRAITS) {
    for (const commitment of normal.AI_COMMITMENT_TRAITS) for (let deck = 0; deck < presets.length; deck++) {
      const traits = [motive.id === "element-loyalist"
        ? { ...motive, element: decks.ELEMENTS[deck % 3] } : motive, placement, commitment];
      simulateMatch(presets[(deck + 1) % 4], presets[deck], 2100 + matches * 131, traits);
      matches++;
    }
  }
  assert.equal(matches, 576);
});

test("deckbuilding is packaged before the game and only constructs personal Four-Lane decks", () => {
  const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const packaging = readFileSync(new URL("../scripts/copy-static.js", import.meta.url), "utf8");
  assert.ok(page.indexOf("./src/deckbuilding.js") < page.indexOf("./src/game.js"));
  assert.ok(packaging.includes('cp("src/deckbuilding.js", "dist/src/deckbuilding.js")'));
  const start = gameSource.indexOf("function freshPersonalDeck(");
  const source = gameSource.slice(start, gameSource.indexOf("\n}", start) + 2);
  const context = { constructedDecks: decks, fourLaneDeckCatalog: catalog, matchFourLaneDeck: presets[1], matchFourLaneOpponent: { deck: presets[2] }, shuffle: value => value };
  runInNewContext(source, context);
  assert.equal(context.freshPersonalDeck("player").length, 24);
  assert.deepEqual(context.freshPersonalDeck("player").map(card => card.art), presets[1].cards);
  assert.deepEqual(context.freshPersonalDeck("opponent").map(card => card.art), presets[2].cards);
  assert.match(gameSource, /state\.deck = isFourLaneMode\(\) \? freshPersonalDeck\("player"\) : freshDeck\(\)/);
});
