import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { catalog } from "../scripts/audit-deckbuilding.js";

const api = globalThis.ClawDeckbuilding;
const starters = api.createStarterPresets(catalog);
const elements = globalThis.ClawRules.ELEMENTS;
const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const game = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const editor = readFileSync(new URL("../src/deck-editor.js", import.meta.url), "utf8");
function gameFunction(name) {
  const start = game.indexOf(`function ${name}(`);
  assert.notEqual(start, -1);
  return game.slice(start, game.indexOf("\n}", start) + 2);
}
function element() {
  return { hidden: false, attributes: {}, focusCount: 0,
    focus() { this.focusCount++; },
    removeAttribute(key) { delete this.attributes[key]; },
    setAttribute(key, value) { this.attributes[key] = value; } };
}
function lobbyContext(deck = starters[0]) {
  const ui = Object.fromEntries(["fourLaneDeckPage", "fourLaneRivalPage", "fourLaneDeckChoiceTitle", "fourLaneRivalTitle",
    "fourLaneDeckStep", "fourLaneRivalStep", "fourLaneConfirmedDeckName", "fourLaneConfirmedDeckSummary"].map(id => [id, element()]));
  ui.fourLanePreviewScreen = { scrollTop: 800 };
  const context = { ui, constructedDecks: api, fourLaneDeckCatalog: catalog, ELEMENTS: elements,
    fourLaneDeckEditor: { getSelectedDeck: () => deck }, confirmedFourLaneDeck: null };
  runInNewContext(["showFourLaneLobbyStep", "confirmFourLaneDeck"].map(gameFunction).join("\n"), context);
  return context;
}

test("deck and rival pages are separate, with two clear deck paths and an explicit confirmation", () => {
  const deckPage = page.slice(page.indexOf('id="fourLaneDeckPage"'), page.indexOf('id="fourLaneRivalPage"'));
  const rivalPage = page.slice(page.indexOf('id="fourLaneRivalPage"'), page.indexOf('class="four-lane-preview-notice"'));
  assert.match(deckPage, /Choose a starter deck/);
  assert.match(deckPage, /Or make it your own/);
  assert.match(deckPage, /Build your own deck/);
  assert.match(deckPage, /Your saved decks/);
  assert.match(deckPage, /id="fourLaneConfirmDeckButton"/);
  assert.doesNotMatch(deckPage, /id="fourLaneRivalOptions"|id="fourLaneStartButton"/);
  assert.match(rivalPage, /^id="fourLaneRivalPage" hidden>/);
  assert.match(rivalPage, /Back to Your Deck/);
  assert.match(rivalPage, /Choose Difficulty/);
  assert.match(page, /<ol class="four-lane-lobby-steps" aria-label="Duel setup">/);
  assert.match(page, /<details class="four-lane-basics">/);
});

test("confirmation moves to the rival page with a safe, immutable snapshot of the selected deck", () => {
  const selected = { ...starters[1], name: '<b>My Rally deck</b>', cards: [...starters[1].cards] };
  const context = lobbyContext(selected);
  context.showFourLaneLobbyStep();
  assert.equal(context.ui.fourLaneRivalPage.hidden, true);
  assert.equal(context.ui.fourLaneDeckStep.attributes["aria-current"], "step");
  context.confirmFourLaneDeck();
  assert.equal(context.ui.fourLaneDeckPage.hidden, true);
  assert.equal(context.ui.fourLaneRivalPage.hidden, false);
  assert.equal(context.ui.fourLaneConfirmedDeckName.textContent, selected.name);
  assert.match(context.ui.fourLaneConfirmedDeckSummary.textContent, /24 cards.*120 cost.*Fire 8.*Gust 8.*Water 8/);
  assert.equal(context.ui.fourLaneConfirmedDeckName.innerHTML, undefined);
  assert.equal(context.ui.fourLaneRivalStep.attributes["aria-current"], "step");
  assert.equal(context.ui.fourLaneDeckStep.attributes["aria-current"], undefined);
  assert.equal(context.ui.fourLanePreviewScreen.scrollTop, 0);
  assert.equal(context.ui.fourLaneRivalTitle.focusCount, 1);
  assert.ok(Object.isFrozen(context.confirmedFourLaneDeck));
  assert.ok(Object.isFrozen(context.confirmedFourLaneDeck.cards));
  selected.cards.pop();
  assert.equal(context.confirmedFourLaneDeck.cards.length, 24);
});

test("going back invalidates confirmation, preserves selection and allows another deck to be confirmed", () => {
  const context = lobbyContext();
  context.confirmFourLaneDeck();
  context.showFourLaneLobbyStep("deck");
  assert.equal(context.confirmedFourLaneDeck, null);
  assert.equal(context.ui.fourLaneDeckPage.hidden, false);
  assert.equal(context.ui.fourLaneRivalPage.hidden, true);
  assert.equal(context.fourLaneDeckEditor.getSelectedDeck(), starters[0]);
  context.fourLaneDeckEditor.getSelectedDeck = () => starters[2];
  context.confirmFourLaneDeck();
  assert.equal(context.confirmedFourLaneDeck.name, "Element Weavers");
  assert.equal(context.ui.fourLaneRivalPage.hidden, false);
});

test("invalid decks cannot be confirmed and an unconfirmed deck cannot launch a duel", () => {
  const context = lobbyContext({ ...starters[0], cards: [] });
  context.confirmFourLaneDeck();
  assert.equal(context.confirmedFourLaneDeck, null);
  context.showFourLaneLobbyStep("rival");
  assert.equal(context.ui.fourLaneRivalPage.hidden, true);
  let rolls = 0;
  context.fourLaneOpponents = { createEncounter() { rolls++; } };
  context.isFourLaneMode = () => false;
  runInNewContext(gameFunction("showDifficultyChooser"), context);
  context.showDifficultyChooser("four-lane");
  assert.equal(rolls, 0);
  assert.equal(context.matchFourLaneDeck, undefined);
});

test("difficulty Back returns to the rival step rather than restarting deck selection", () => {
  const context = lobbyContext();
  context.confirmFourLaneDeck();
  const confirmed = context.confirmedFourLaneDeck;
  context.difficultyReturnTarget = "four-lane";
  context.ui.difficultyDialog = {};
  context.closeDialog = () => {};
  context.showFourLanePreview = step => context.showFourLaneLobbyStep(step);
  runInNewContext(gameFunction("leaveDifficultyChooser"), context);
  context.leaveDifficultyChooser();
  assert.equal(context.confirmedFourLaneDeck, confirmed);
  assert.equal(context.ui.fourLaneRivalPage.hidden, false);
  assert.equal(context.ui.fourLaneDeckPage.hidden, true);
  assert.match(game, /fourLaneConfirmDeckButton\.addEventListener\("click", confirmFourLaneDeck\)/);
  assert.match(game, /fourLaneChangeDeckButton\.addEventListener\("click", \(\) => showFourLaneLobbyStep\("deck"\)\)/);
  assert.match(game, /if \(!ui\.fourLaneRivalPage\.hidden\) showFourLaneLobbyStep\("deck"\);\s+else leaveFourLanePreview\(\)/);
});

test("all starter descriptions are concise and explain their actual role identity", () => {
  for (const deck of starters) {
    assert.ok(deck.description.length <= 140);
    assert.ok(api.validateDeck(catalog, deck).valid);
  }
  assert.match(starters[0].description, /all four roles/);
  assert.match(starters[1].description, /Vanguards.*Rally/);
  assert.match(starters[2].description, /Alternate elements.*Link/);
  assert.match(starters[3].description, /Finisher.*last.*\+1/);
});

test("starter cards and saved decks remain mutually exclusive, with safe names and useful empty states", () => {
  const store = api.createDeckStore(catalog, null);
  const radios = [];
  const options = { children: [], querySelectorAll: () => radios };
  Object.defineProperty(options, "innerHTML", { set(value) {
    this.markup = value; this.children = [1];
    radios.push(...[...value.matchAll(/value="(starter:[^"]+)"/g)].map(match => ({ value: match[1], checked: false })));
  } });
  const select = { replaceChildren(...children) { this.children = children; } };
  const ui = { fourLaneStarterOptions: options, fourLaneDeckSelect: select,
    fourLaneSavedHelp: {}, fourLaneSelectedDeckName: {}, fourLaneConfirmDeckButton: {},
    fourLaneDeckSummary: {}, fourLaneDeckStorageNotice: {} };
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const context = { api, catalog, starters, store, ui, elements, escape,
    option: (value, textContent) => ({ value, textContent }) };
  const start = editor.indexOf("    function renderLobby()");
  runInNewContext(editor.slice(start, editor.indexOf("    function renderCollection()", start)), context);
  context.renderLobby();
  assert.equal(radios.length, 4);
  assert.deepEqual(radios.filter(input => input.checked).map(input => input.value), ["starter:balanced"]);
  assert.equal(select.disabled, true);
  assert.match(select.children[0].textContent, /No saved decks yet/);
  assert.match(ui.fourLaneSavedHelp.textContent, /Build and save/);
  assert.match(ui.fourLaneDeckStorageNotice.textContent, /session only/);
  const originalRadio = radios[0];
  const saved = store.save({ ...starters[2], name: '<img src=x onerror="bad()">' });
  context.renderLobby();
  assert.equal(select.disabled, false);
  assert.equal(select.value, saved.id);
  assert.equal(select.children[1].textContent, saved.name);
  assert.equal(select.children[1].innerHTML, undefined);
  assert.equal(ui.fourLaneSelectedDeckName.textContent, saved.name);
  assert.equal(radios.some(input => input.checked), false);
  store.select("starter:finisher");
  context.renderLobby();
  assert.equal(select.value, "");
  assert.equal(radios[0], originalRadio, "radio focus is preserved during a selection change");
  assert.deepEqual(radios.filter(input => input.checked).map(input => input.value), ["starter:finisher"]);
  assert.match(options.markup, /Earlier Finishers still fight normally/);
  assert.equal(ui.fourLaneConfirmDeckButton.disabled, false);
});
