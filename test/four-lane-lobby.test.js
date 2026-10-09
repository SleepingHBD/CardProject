import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { catalog } from "../scripts/audit-deckbuilding.js";
import "../src/deck-editor.js";

const api = globalThis.ClawDeckbuilding;
const starters = api.createStarterPresets(catalog);
const elements = globalThis.ClawRules.ELEMENTS;
const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const game = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const editor = readFileSync(new URL("../src/deck-editor.js", import.meta.url), "utf8");
const lobbyUi = globalThis.ClawDeckEditor;
const visibleCopy = markup => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
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
    fourLaneDeckEditor: { getSelectedDeck: () => deck }, confirmedFourLaneDeck: null, ClawDeckEditor: lobbyUi };
  runInNewContext(["showFourLaneLobbyStep", "confirmFourLaneDeck"].map(gameFunction).join("\n"), context);
  return context;
}

test("deck and rival pages are separate, with two clear deck paths and an explicit confirmation", () => {
  const deckPage = page.slice(page.indexOf('id="fourLaneDeckPage"'), page.indexOf('id="fourLaneRivalPage"'));
  const rivalPage = page.slice(page.indexOf('id="fourLaneRivalPage"'), page.indexOf('class="four-lane-preview-notice"'));
  assert.match(deckPage, /Starter decks/);
  assert.match(deckPage, /Ready to play/);
  assert.match(deckPage, /Or customise/);
  assert.match(deckPage, /Build your own/);
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
  assert.match(visibleCopy(context.ui.fourLaneConfirmedDeckSummary.innerHTML), /24 cards.*119\/120 cost.*8 Fire cards.*8 Gust cards.*8 Water cards/);
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

test("starter descriptions explain deck specialities and player preferences, not role activation instructions", () => {
  for (const deck of starters) {
    assert.ok(deck.description.length >= 100 && deck.description.length <= 180);
    assert.ok(api.validateDeck(catalog, deck).valid);
    assert.match(deck.description, /Suits players who/);
    assert.doesNotMatch(deck.description, /\+1|Lane [1-4]|directly (before|after)/);
  }
  assert.match(starters[0].description, /adaptable all-rounder.*all four roles.*changing plans/);
  assert.match(starters[1].description, /support-heavy.*adjacent Rally partnerships.*reinforcing key lanes/);
  assert.match(starters[2].description, /combination-focused.*Link and mixed elements.*planning card (order|positions)/);
  assert.match(starters[3].description, /Finisher-heavy.*(formation endings|rightmost threat)/);
  const balancedRoles = Object.values(api.validateDeck(catalog, starters[0]).summary.roleCounts);
  assert.ok(Math.max(...balancedRoles) - Math.min(...balancedRoles) <= 2, "the all-rounder mixes its roles evenly");
  for (const deck of starters.slice(1)) {
    const roles = api.validateDeck(catalog, deck).summary.roleCounts;
    assert.ok(Object.entries(roles).every(([role, count]) => role === deck.id || roles[deck.id] > count),
      `${deck.name}'s advertised speciality is its most common role`);
  }
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
    option: (value, textContent) => ({ value, textContent }),
    lobbyIconMarkup: lobbyUi.lobbyIconMarkup, lobbyDeckStatsMarkup: lobbyUi.lobbyDeckStatsMarkup };
  const start = editor.indexOf("    function renderLobby()");
  runInNewContext(editor.slice(start, editor.indexOf("    function renderCollection()", start)), context);
  context.renderLobby();
  assert.equal(radios.length, 4);
  assert.deepEqual(radios.filter(input => input.checked).map(input => input.value), ["starter:balanced"]);
  assert.equal(select.disabled, true);
  assert.match(select.children[0].textContent, /No saved decks yet/);
  assert.match(ui.fourLaneSavedHelp.textContent, /Build and save/);
  assert.match(ui.fourLaneDeckSummary.innerHTML, /lobby-element-stats/);
  assert.match(options.markup, /#tactic-icon-banner/);
  assert.match(options.markup, /#tactic-icon-chain/);
  assert.match(options.markup, /#tactic-icon-sword/);
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
  assert.match(options.markup, /A Finisher-heavy deck built around/);
  assert.equal(ui.fourLaneConfirmDeckButton.disabled, false);
});

test("compact deck statistics show exact counts with labelled elements and shared role symbols", () => {
  for (const deck of starters) {
    const summary = api.validateDeck(catalog, deck).summary;
    const markup = lobbyUi.lobbyDeckStatsMarkup(summary);
    assert.match(markup, /#lobby-icon-cards/);
    assert.match(markup, /#lobby-icon-coins/);
    assert.match(visibleCopy(markup), new RegExp(`${summary.count} cards.*${summary.totalCost}/120 cost`));
    for (const key of api.ELEMENTS) {
      assert.ok(markup.includes(elements[key].icon));
      assert.ok(markup.includes(`title="${elements[key].label}: ${summary.elementCounts[key]} cards"`));
      assert.ok(markup.includes(` ${elements[key].label} cards</span>`));
    }
    assert.doesNotMatch(lobbyUi.lobbyDeckStatsMarkup(summary, false), /lobby-element-stats/);
  }
  for (const [role, symbol] of Object.entries({ vanguard: "shield", rally: "banner", link: "chain", finisher: "sword" })) {
    assert.match(lobbyUi.lobbyIconMarkup(role), new RegExp(`#tactic-icon-${symbol}`));
  }
  assert.match(lobbyUi.lobbyIconMarkup('" onload="bad'), /#lobby-icon-cards/);
  assert.doesNotMatch(lobbyUi.lobbyIconMarkup('" onload="bad'), /onload/);
});

test("rivals explain expected playstyles while preserving uncertainty, icons and selectable profiles", () => {
  const profiles = globalThis.ClawFourLaneOpponents.createRoster(catalog);
  assert.ok(profiles.every(rival => rival.description.length >= 100 && rival.description.length <= 180));
  assert.match(profiles[0].description, /adaptable all-rounder.*playstyle varies with its habits/);
  assert.match(profiles[1].description, /support-heavy.*adjacent Rally partnerships and Vanguard openers.*reinforcing key fighters/);
  assert.match(profiles[2].description, /combination-focused.*Link and mixed elements.*adjacent card combinations/);
  assert.match(profiles[3].description, /Finisher-heavy.*rightmost threat.*short formation or a wider push/);
  assert.ok(profiles.every(rival => !/\balways\b/i.test(rival.description)));
  assert.ok(profiles.every(rival => !/\+1|Lane [1-4]|directly (before|after)/.test(rival.description)));
  const container = {};
  const context = { fourLaneOpponentRoster: profiles, selectedFourLaneOpponent: "link", ClawDeckEditor: lobbyUi,
    document: { querySelector: () => container } };
  runInNewContext(gameFunction("renderFourLaneOpponents"), context);
  context.renderFourLaneOpponents();
  assert.equal((container.innerHTML.match(/type="radio"/g) || []).length, 5);
  assert.match(container.innerHTML, /value="link" checked/);
  assert.match(container.innerHTML, /#lobby-icon-shuffle/);
  for (const profile of profiles) assert.ok(container.innerHTML.includes(profile.name));
  assert.match(container.innerHTML, /Best for Blind/);
  assert.match(container.innerHTML, /Previous Rounds History to uncover its habits/);
  assert.match(container.innerHTML, /lobby-rival-theme/);
  assert.match(container.innerHTML, /lobby-rival-description/);
});

test("lobby help uses a compact numeric hierarchy while detailed rules retain every condition", () => {
  assert.match(page, /class="lobby-basics-grid"/);
  assert.match(page, /Draw up to 3 each round\. Max\. 7/);
  assert.match(page, /trophies each/);
  assert.match(page, /class="lobby-scoring-notes"/);
  assert.match(page, /one unlock per lane win · max\. 2/);
  assert.match(page, /Unlike Normal Play, there is no trophy choice/);
  assert.match(page, /Each element stops at 6 trophies/);
  assert.match(page, /One lane win unlocks one card, not every unopposed card/);
  for (const symbol of ["cards", "coins", "shuffle", "trophy"]) assert.ok(page.includes(`id="lobby-icon-${symbol}" viewBox="0 0 24 24"`));
  const css = readFileSync(new URL("../deckbuilding.css", import.meta.url), "utf8");
  assert.match(css, /\.lobby-element-stats[^}]*flex-wrap:\s*wrap/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*\.lobby-basics-grid \{ grid-template-columns: minmax\(0, 1fr\)/);
});

test("WIP guidance explains free positions, earned unopposed rewards and three-card replenishment", () => {
  const rules = visibleCopy(page.slice(page.indexOf('id="fourLaneRulesDialog"'), page.indexOf('id="resultDialog"')));
  assert.match(rules, /Commit 1–4 cards in any of the four lanes, one card per lane/);
  assert.match(rules, /Gaps are allowed/);
  assert.match(rules, /lane positions—not the order you click cards—determine/);
  assert.match(rules, /2 trophies of the winning card's element/);
  assert.match(rules, /Each lane you win unlocks one of your unopposed cards.*1 trophy of its own element.*two unopposed trophies per round/);
  assert.match(rules, /Lane 1 to Lane 4, skipping unopposed cards whose element already has 6 trophies/);
  assert.match(rules, /lane win still unlocks a reward even when the winning card's element is complete/);
  assert.match(rules, /No lane wins means no unopposed trophies.*Drawn lanes do not unlock rewards/);
  assert.match(rules, /rightmost card.*at least two cards.*does not have to occupy Lane 4/);
  assert.match(rules, /neighbouring lane to its left.*empty lane to its left gives no bonus/);
  assert.match(rules, /cannot reach Lane 1 if Lane 2 is empty/);
  assert.match(rules, /draws up to 3 without exceeding 7/);
  assert.match(rules, /Commit 3 cards to maintain your hand size, or 4 to spend 1/);
  assert.match(rules, /four consecutive rounds in which neither side earns trophies/);
  assert.match(rules, /150 rounds.*duel ends in a draw/);
  assert.doesNotMatch(rules, /Commit 1–4 cards in order|draws up to 2|first two cards with no opposing card/);
});

test("Normal Play guidance keeps its three-lane formation, trophy choice and six-card refill", () => {
  const normalRules = visibleCopy(page.slice(page.indexOf('id="rulebookDialog"'), page.indexOf('id="fourLaneRulesDialog"')));
  assert.match(normalRules, /Lane 1 fights Lane 1, Lane 2 fights Lane 2, and Lane 3 fights Lane 3/);
  assert.match(normalRules, /Winning a round awards exactly one trophy/);
  assert.match(normalRules, /Both duelists draw up to six cards/);
  assert.match(normalRules, /final card in a 2–3 card formation/);
  assert.doesNotMatch(normalRules, /unlock.*unopposed|150 rounds|draws up to 3/);
});
