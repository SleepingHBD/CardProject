import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { runInNewContext } from "node:vm";

const gameSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const rulesSource = readFileSync(new URL("../src/rules.js", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../assets/cards/four-lane/rare-rally-artwork.json", import.meta.url), "utf8"));

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
  context.ELEMENTS = context.ClawRules.ELEMENTS;
  context.TACTICS = context.ClawRules.TACTICS;
  runInNewContext([
    gameSource.slice(gameSource.indexOf("const CARD_LIBRARY ="), gameSource.indexOf("const HAND_SIZE =")),
    gameSource.slice(gameSource.indexOf("const FOUR_LANE_RALLY_CARDS ="), gameSource.indexOf("const DIFFICULTIES =")),
    sourceFunction("cardMarkup"),
    sourceFunction("renderFourLaneCards"),
    sourceFunction("freshDeck"),
  ].join("\n"), context);
  return context;
}

test("the framed Rally cards match the approved artwork manifest", () => {
  const context = fixture();
  const cards = JSON.parse(runInNewContext("JSON.stringify(FOUR_LANE_RALLY_CARDS)", context));
  assert.equal(cards.length, 3);
  for (const approved of manifest.cards) {
    const card = cards.find(card => card.name === approved.name);
    assert.ok(card);
    assert.equal(card.element, approved.element);
    assert.equal(card.move, approved.move);
    assert.deepEqual({ rarity: card.rarity, role: card.tactic, power: card.power }, approved.intendedStats);
    assert.equal(card.artworkSource, `./assets/cards/four-lane/${approved.asset}`);
    assert.ok(existsSync(new URL(`../${card.artworkSource}`, import.meta.url)));
  }
});

test("the preview reuses the Rare card frame with Rally labels, icons and safe non-playable markup", () => {
  const context = fixture();
  runInNewContext("renderFourLaneCards()", context);
  const markup = context.ui.fourLaneCardGallery.innerHTML;
  assert.equal((markup.match(/class="game-card element-\w+ rarity-rare/g) || []).length, 3);
  assert.equal((markup.match(/data-card-preview="four-lane"/g) || []).length, 3);
  assert.equal((markup.match(/<b>6<\/b>/g) || []).length, 3);
  assert.equal((markup.match(/href="#tactic-icon-banner"/g) || []).length, 6);
  assert.equal((markup.match(/\sdisabled/g) || []).length, 3);
  assert.doesNotMatch(markup, /data-card-id|draggable="true"|>Link<|>Vanguard</);
  assert.match(pageSource, /symbol id="tactic-icon-banner"/);
  assert.match(pageSource, /id="fourLaneCardGallery" role="list"/);
  assert.match(pageSource, /their gameplay bonus is not active yet/);
});

test("Rally card previews do not change the normal library, deck or role scoring", () => {
  const context = fixture();
  const deck = JSON.parse(runInNewContext("JSON.stringify(freshDeck())", context));
  assert.equal(runInNewContext("CARD_LIBRARY.length", context), 24);
  assert.equal(runInNewContext("MAX_PLAY_SIZE", context), 3);
  assert.equal(deck.length, 39);
  assert.ok(deck.every(card => card.tactic !== "rally" && !card.artworkSource));
  assert.deepEqual(Object.keys(context.TACTICS), ["vanguard", "link", "finisher"]);
  const normalMarkup = runInNewContext("cardMarkup(CARD_LIBRARY[1])", context);
  assert.match(normalMarkup, /assets\/cards\/candle-pounce.webp/);
  assert.match(normalMarkup, /#tactic-icon-shield/);
  assert.doesNotMatch(normalMarkup, /data-card-preview|Rally/);
});

test("updating artwork preferences cannot replace a Rally preview with a missing normal-card image", () => {
  const context = fixture();
  const preview = {
    dataset: { cardTemplate: "deshone-dewguard", cardPreview: "four-lane" },
    querySelector: () => { throw new Error("preview artwork must not be overwritten"); },
  };
  context.document = {
    documentElement: { dataset: {} },
    querySelectorAll: () => [preview],
  };
  assert.doesNotThrow(() => runInNewContext(sourceFunction("updateDisplayedCardArtwork") + "\nupdateDisplayedCardArtwork()", context));
});
