import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { runInNewContext } from "node:vm";

const gameSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const rulesSource = readFileSync(new URL("../src/rules.js", import.meta.url), "utf8");
const fourLaneRulesSource = readFileSync(new URL("../src/four-lane-rules.js", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const approvedCards = ["rare-rally-artwork.json", "uncommon-rally-artwork.json", "common-rally-artwork.json"].flatMap(file => (
  JSON.parse(readFileSync(new URL(`../assets/cards/four-lane/${file}`, import.meta.url), "utf8")).cards
));
const additionalUncommons = JSON.parse(readFileSync(new URL("../assets/cards/four-lane/uncommon-expansion-artwork.json", import.meta.url), "utf8")).cards;

function sourceFunction(name) {
  const start = gameSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  return gameSource.slice(start, gameSource.indexOf("\n}", start) + 2);
}

function fixture() {
  const context = {
    state: { artworkStyle: "illustrated" },
    ui: { fourLaneCardGallery: { innerHTML: "" } },
    cardDisplayName: card => card.name,
    cardUsesPhotographicArtwork: () => false,
    cardArtworkSource: art => `./assets/cards/${art}.webp`,
    shuffle: cards => cards,
  };
  runInNewContext(rulesSource, context);
  runInNewContext(fourLaneRulesSource, context);
  context.ELEMENTS = context.ClawRules.ELEMENTS;
  context.TACTICS = context.ClawRules.TACTICS;
  runInNewContext([
    gameSource.slice(gameSource.indexOf("const CARD_LIBRARY ="), gameSource.indexOf("const HAND_SIZE =")),
    gameSource.slice(gameSource.indexOf("const FOUR_LANE_RALLY_CARDS ="), gameSource.indexOf("const DIFFICULTIES =")),
    sourceFunction("cardRoleDefinition"),
    sourceFunction("cardMarkup"),
    sourceFunction("renderFourLaneCards"),
    sourceFunction("freshDeck"),
  ].join("\n"), context);
  return context;
}

test("all nine framed Rally cards match their approved artwork manifests", () => {
  const context = fixture();
  const cards = JSON.parse(runInNewContext("JSON.stringify(FOUR_LANE_RALLY_CARDS)", context));
  assert.equal(cards.length, 9);
  assert.equal(new Set(cards.map(card => card.id)).size, 9);
  for (const approved of approvedCards) {
    const card = cards.find(card => card.name === approved.name);
    assert.ok(card);
    assert.equal(card.element, approved.element);
    assert.equal(card.move, approved.move);
    if (approved.lore) assert.equal(card.lore, approved.lore);
    assert.deepEqual({ rarity: card.rarity, role: card.tactic, power: card.power }, approved.intendedStats);
    assert.equal(card.artworkSource, `./assets/cards/four-lane/${approved.asset}`);
    assert.ok(existsSync(new URL(`../${card.artworkSource}`, import.meta.url)));
  }
});

test("Jyawaye's rename updates display and accessibility text without changing preview identity or stats", () => {
  const context = fixture();
  const cards = JSON.parse(runInNewContext("JSON.stringify(FOUR_LANE_RALLY_CARDS)", context));
  const card = cards.find(card => card.id === "four-lane-jiawen-barleybreeze");
  assert.equal(card.name, "Jyawaye");
  assert.equal(card.art, "jiawen-barleybreeze");
  assert.equal(card.artworkSource, "./assets/cards/four-lane/jiawen-barleybreeze.png");
  assert.equal(card.move, "Harvest Breeze");
  assert.deepEqual({ element: card.element, rarity: card.rarity, role: card.tactic, power: card.power }, {
    element: "gust", rarity: "common", role: "rally", power: 4,
  });
  runInNewContext("renderFourLaneCards()", context);
  assert.match(context.ui.fourLaneCardGallery.innerHTML, /<strong>Jyawaye<\/strong>/);
  assert.match(context.ui.fourLaneCardGallery.innerHTML, /aria-label="Jyawaye, Gust, Common, Power 4, Rally role, preview only"/);
  assert.doesNotMatch(context.ui.fourLaneCardGallery.innerHTML, /Jiawen Barleybreeze/);
});

test("all twelve new cards use first names in both visible and accessible labels without changing asset identities", () => {
  const context = fixture();
  const cards = JSON.parse(runInNewContext("JSON.stringify(FOUR_LANE_CARDS)", context));
  const expected = [
    ["Hareth", "hareth-hearthbeat"], ["Megwyn", "megwyn-windwhistle"], ["Deshone", "deshone-dewguard"],
    ["Charmae", "charmae-emberhem"], ["Aakith", "aakith-wayfinder"], ["Sajrin", "sajrin-shellwright"],
    ["Lucan", "lucan-cinderclay"], ["Jyawaye", "jiawen-barleybreeze"], ["Siewen", "siewen-rainkeeper"],
    ["Shazmir", "shazmir-ashveil"], ["Hidayn", "hidayn-windbrace"], ["Isai", "isai-tidebind"],
  ];
  assert.deepEqual(cards.map(card => [card.name, card.art]), expected);
  assert.equal(new Set(cards.map(card => card.name)).size, 12);
  for (const card of cards) {
    assert.equal(card.id, `four-lane-${card.art}`);
    assert.equal(card.artworkSource, `./assets/cards/four-lane/${card.art}.png`);
    assert.match(card.name, /^[A-Za-z]+$/);
    const markup = runInNewContext(`cardMarkup(FOUR_LANE_CARDS[${cards.indexOf(card)}], false, -1, "four-lane-preview")`, context);
    assert.match(markup, new RegExp(`<strong>${card.name}</strong>`));
    assert.match(markup, new RegExp(`aria-label="${card.name}, `));
  }
});

test("the preview reuses rarity frames with correct role labels, icons and safe non-playable markup", () => {
  const context = fixture();
  runInNewContext("renderFourLaneCards()", context);
  const markup = context.ui.fourLaneCardGallery.innerHTML;
  assert.equal((markup.match(/class="game-card element-\w+ rarity-rare/g) || []).length, 3);
  assert.equal((markup.match(/class="game-card element-\w+ rarity-uncommon/g) || []).length, 6);
  assert.equal((markup.match(/class="game-card element-\w+ rarity-common/g) || []).length, 3);
  assert.equal((markup.match(/data-card-preview="four-lane"/g) || []).length, 12);
  assert.equal((markup.match(/<b>6<\/b>/g) || []).length, 3);
  assert.equal((markup.match(/<b>5<\/b>/g) || []).length, 6);
  assert.equal((markup.match(/<b>4<\/b>/g) || []).length, 3);
  assert.equal((markup.match(/href="#tactic-icon-banner"/g) || []).length, 18);
  assert.equal((markup.match(/\sdisabled/g) || []).length, 12);
  assert.equal((markup.match(/, Rare, Power 6, Rally role, preview only/g) || []).length, 3);
  assert.equal((markup.match(/, Uncommon, Power 5, Rally role, preview only/g) || []).length, 3);
  assert.equal((markup.match(/, Common, Power 4, Rally role, preview only/g) || []).length, 3);
  for (const role of ["Link", "Vanguard", "Finisher"]) {
    assert.equal((markup.match(new RegExp(`, Uncommon, Power 5, ${role} role, preview only`, "g")) || []).length, 1);
  }
  for (const icon of ["chain", "shield", "sword"]) {
    assert.equal((markup.match(new RegExp(`href="#tactic-icon-${icon}"`, "g")) || []).length, 2);
  }
  assert.doesNotMatch(markup, /data-card-id|draggable="true"/);
  assert.match(pageSource, /symbol id="tactic-icon-banner"/);
  assert.match(pageSource, /id="fourLaneCardGallery" role="list"/);
  assert.match(pageSource, /These cards are now playable in Super Secret Stuff WIP/);
});

test("all three additional Uncommon frames match the approved final artwork and intended roles", () => {
  const context = fixture();
  const cards = JSON.parse(runInNewContext("JSON.stringify(FOUR_LANE_UNCOMMON_CARDS)", context));
  assert.equal(cards.length, 3);
  const allCards = JSON.parse(runInNewContext("JSON.stringify(FOUR_LANE_CARDS)", context));
  assert.equal(allCards.length, 12);
  assert.equal(new Set(allCards.map(card => card.id)).size, 12);
  for (const approved of additionalUncommons) {
    const card = cards.find(card => card.name === approved.name);
    assert.ok(card);
    assert.equal(card.element, approved.element);
    assert.equal(card.move, approved.move);
    assert.equal(card.lore, approved.lore);
    assert.deepEqual({ rarity: card.rarity, role: card.tactic, power: card.power }, approved.intendedStats);
    assert.equal(card.artworkSource, `./assets/cards/four-lane/${approved.asset}`);
    assert.ok(existsSync(new URL(`../${card.artworkSource}`, import.meta.url)));
    assert.ok(Object.isFrozen(runInNewContext(`FOUR_LANE_UNCOMMON_CARDS[${cards.indexOf(card)}]`, context)));
    const markup = runInNewContext(`cardMarkup(FOUR_LANE_UNCOMMON_CARDS[${cards.indexOf(card)}], false, -1, "four-lane-preview")`, context);
    const role = context.TACTICS[card.tactic];
    assert.match(markup, new RegExp(`#tactic-icon-${role.icon}`));
    assert.match(markup, new RegExp(`${role.label} role, preview only`));
    assert.doesNotMatch(markup, /Rally|data-card-id|draggable="true"/);
  }
  assert.match(pageSource, /Nine Rally cards, plus three Uncommon cards/);
});

test("each element has one Rare, one Uncommon and one Common Rally preview", () => {
  const cards = JSON.parse(runInNewContext("JSON.stringify(FOUR_LANE_RALLY_CARDS)", fixture()));
  for (const element of ["ember", "gust", "tide"]) {
    assert.deepEqual(cards.filter(card => card.element === element).map(card => [card.rarity, card.power]), [
      ["rare", 6], ["uncommon", 5], ["common", 4],
    ]);
  }
});

test("four-lane card previews do not change the normal library, deck or role scoring", () => {
  const context = fixture();
  const deck = JSON.parse(runInNewContext("JSON.stringify(freshDeck())", context));
  assert.equal(runInNewContext("CARD_LIBRARY.length", context), 24);
  assert.equal(runInNewContext("MAX_PLAY_SIZE", context), 3);
  assert.equal(deck.length, 39);
  assert.ok(deck.every(card => card.tactic !== "rally" && !card.artworkSource));
  const previewArts = JSON.parse(runInNewContext("JSON.stringify(FOUR_LANE_CARDS.map(card => card.art))", context));
  assert.ok(deck.every(card => !previewArts.includes(card.art)));
  assert.deepEqual(Object.keys(context.TACTICS), ["vanguard", "link", "finisher"]);
  const normalMarkup = runInNewContext("cardMarkup(CARD_LIBRARY[1])", context);
  assert.match(normalMarkup, /assets\/cards\/candle-pounce.webp/);
  assert.match(normalMarkup, /#tactic-icon-shield/);
  assert.doesNotMatch(normalMarkup, /data-card-preview|Rally/);
});

test("updating artwork preferences cannot replace any four-lane preview with a missing normal-card image", () => {
  const context = fixture();
  const previews = JSON.parse(runInNewContext("JSON.stringify(FOUR_LANE_CARDS)", context)).map(card => ({
    dataset: { cardTemplate: card.art, cardPreview: "four-lane" },
    querySelector: () => { throw new Error("preview artwork must not be overwritten"); },
  }));
  context.document = {
    documentElement: { dataset: {} },
    querySelectorAll: () => previews,
  };
  assert.doesNotThrow(() => runInNewContext(sourceFunction("updateDisplayedCardArtwork") + "\nupdateDisplayedCardArtwork()", context));
});
