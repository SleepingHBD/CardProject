import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import "../src/deckbuilding.js";

const api = globalThis.ClawDeckbuilding;
const gameSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const library = runInNewContext([
  gameSource.slice(gameSource.indexOf("const CARD_LIBRARY ="), gameSource.indexOf("const HAND_SIZE =")),
  gameSource.slice(gameSource.indexOf("const FOUR_LANE_RALLY_CARDS ="), gameSource.indexOf("const DIFFICULTIES =")),
  "[...CARD_LIBRARY, ...FOUR_LANE_CARDS]",
].join("\n"));
const catalog = api.createCardCatalog(library), starters = api.createStarterPresets(catalog);
const memory = raw => {
  let value = raw ?? null;
  return { getItem: key => { assert.equal(key, api.STORAGE_KEY); return value; },
    setItem: (key, next) => { assert.equal(key, api.STORAGE_KEY); value = next; }, raw: () => value };
};
const custom = (name = "My deck", preset = starters[0]) => ({ version: 1, name, cards: [...preset.cards] });

test("fresh storage selects Balanced and keeps all four immutable starters available", () => {
  const disk = memory(), store = api.createDeckStore(catalog, disk);
  assert.equal(store.snapshot().selectedId, "starter:balanced");
  assert.equal(store.snapshot().decks.length, 0);
  assert.equal(disk.raw(), null, "loading does not overwrite stored data");
  assert.equal(store.getDeck(), starters[0]);
  for (const starter of starters) assert.equal(store.getDeck(`starter:${starter.id}`), starter);
  assert.throws(() => store.select("unknown"), RangeError);
  assert.equal(store.getDeck("unknown"), null);
});

test("create/update/select survives refresh without changing the built-in starter", () => {
  const disk = memory(), store = api.createDeckStore(catalog, disk);
  const input = custom("  My Rally  ", starters[1]);
  const saved = store.save(input);
  input.cards.pop();
  assert.equal(saved.name, "My Rally");
  assert.equal(saved.cards.length, 24);
  assert.ok(Object.isFrozen(saved) && Object.isFrozen(saved.cards));
  assert.equal(store.getDeck(), saved);
  let reloaded = api.createDeckStore(catalog, disk);
  assert.deepEqual(reloaded.getDeck(), saved);
  assert.ok(reloaded.snapshot().storageAvailable);
  const updated = reloaded.save(custom("Renamed", starters[3]), saved.id);
  assert.equal(updated.id, saved.id);
  assert.equal(reloaded.snapshot().decks.length, 1);
  assert.equal(reloaded.getDeck().name, "Renamed");
  reloaded.select("starter:link");
  reloaded = api.createDeckStore(catalog, disk);
  assert.equal(reloaded.getDeck(), starters[2]);
  assert.equal(reloaded.snapshot().decks[0].name, "Renamed");
  assert.equal(starters[1].name, "Rally Company");
});

test("saved records contain only canonical definition fields and never mutable runtime stats", () => {
  const disk = memory(), store = api.createDeckStore(catalog, disk);
  const name = '<img src=x onerror="alert(1)">';
  const saved = store.save({ ...custom(name), power: 99, cost: 0, description: "not stored", artworkSource: "https://evil.test" });
  const raw = JSON.parse(disk.raw());
  assert.deepEqual(Object.keys(raw.decks[0]).sort(), ["cards", "id", "name", "version"]);
  assert.equal(raw.decks[0].name, name, "names are data; the editor renders them as text");
  assert.ok(raw.decks[0].cards.every(key => typeof key === "string"));
  assert.equal(api.buildDeckInstances(catalog, saved, "player")[0].power, 4);
  assert.equal(store.getDeck().artworkSource, undefined);
});

test("invalid decks, accidental starter updates and stale IDs cannot replace a legal saved deck", () => {
  const disk = memory(), store = api.createDeckStore(catalog, disk);
  const saved = store.save(custom());
  const before = disk.raw();
  for (const bad of [{ ...custom(), cards: [] }, { ...custom(), version: 2 },
    { ...custom(), cards: Array(24).fill("comet-claw") }, { ...custom(), cards: Array(24).fill({ power: 999 }) }]) {
    assert.throws(() => store.save(bad, saved.id), RangeError);
  }
  for (const id of ["starter:balanced", "custom-nonexistent", "__proto__", {}]) {
    assert.throws(() => store.save(custom(), id), RangeError);
  }
  assert.equal(disk.raw(), before);
  assert.deepEqual(store.snapshot().decks, [saved]);
});

test("twelve deck limit and same-millisecond IDs are safe; existing decks remain editable at capacity", () => {
  const store = api.createDeckStore(catalog, memory());
  const originalNow = Date.now;
  try {
    Date.now = () => 1;
    const saved = Array.from({ length: 12 }, (_, index) => store.save(custom(`Deck ${index}`)));
    assert.equal(new Set(saved.map(deck => deck.id)).size, 12);
    assert.throws(() => store.save(custom("Thirteenth")), /up to 12/);
    assert.equal(store.save(custom("Updated"), saved[0].id).id, saved[0].id);
    assert.equal(store.snapshot().decks.length, 12);
    assert.equal(store.remove(saved[1].id), true);
    store.save(custom("Replacement"));
    assert.equal(store.snapshot().decks.length, 12);
  } finally { Date.now = originalNow; }
});

test("deleting a selected custom deck returns to Balanced; unrelated decks remain saved", () => {
  const disk = memory(), store = api.createDeckStore(catalog, disk);
  const first = store.save(custom("First")), second = store.save(custom("Second"));
  assert.equal(store.remove(first.id), true);
  assert.equal(store.snapshot().selectedId, second.id);
  assert.equal(store.remove(second.id), true);
  assert.equal(store.snapshot().selectedId, "starter:balanced");
  assert.equal(api.createDeckStore(catalog, disk).snapshot().decks.length, 0);
  assert.equal(store.remove(second.id), false);
  assert.throws(() => store.remove("starter:balanced"), /cannot be deleted/);
});

test("corrupt, oversized, future-version and malformed storage recovers without executing or overwriting it", () => {
  for (const raw of ["not json", "x".repeat(64001), JSON.stringify({ version: 2, decks: [] }), "null", "[]", JSON.stringify({ version: 1, decks: {} })]) {
    const disk = memory(raw), store = api.createDeckStore(catalog, disk);
    assert.equal(store.getDeck(), starters[0]);
    assert.ok(store.snapshot().notice);
    assert.equal(disk.raw(), raw);
    store.save(custom());
    assert.equal(api.createDeckStore(catalog, disk).snapshot().decks.length, 1);
  }
});

test("valid saved decks survive alongside invalid, duplicated and forged records", () => {
  const safe = { id: "custom-good", ...custom("Good") };
  const disk = memory(JSON.stringify({ version: 1, selectedId: "custom-bad", decks: [
    safe, { ...safe, name: "Duplicate" }, { id: "__proto__", ...custom() }, { id: "custom-bad", ...custom(), cards: Array(24).fill("unknown") },
  ] }));
  const store = api.createDeckStore(catalog, disk);
  assert.deepEqual(store.snapshot().decks, [safe]);
  assert.equal(store.snapshot().selectedId, "starter:balanced");
  assert.match(store.snapshot().notice, /invalid/);
  const huge = memory(JSON.stringify({ version: 1, selectedId: "starter:balanced", decks: Array.from({ length: 13 }, (_, index) => ({ ...safe, id: `custom-${index}` })) }));
  assert.equal(api.createDeckStore(catalog, huge).snapshot().decks.length, 12);
});

test("blocked reads, blocked writes and full storage do not block session decks or silently claim persistence", () => {
  for (const disk of [undefined, { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } },
    { getItem: () => null, setItem() { throw Error("quota"); } }]) {
    const store = api.createDeckStore(catalog, disk);
    const saved = store.save(custom());
    assert.equal(store.getDeck(), saved);
    assert.equal(store.snapshot().storageAvailable, false);
    assert.match(store.snapshot().notice, /session only/);
    store.select("starter:rally");
    assert.equal(store.getDeck(), starters[1]);
  }
});

test("launch snapshots the selected deck; later saved edits cannot alter restart or difficulty-change decks", () => {
  const store = api.createDeckStore(catalog, memory());
  const saved = store.save(custom("Rally run", starters[1]));
  const start = gameSource.indexOf("function showDifficultyChooser(");
  const source = gameSource.slice(start, gameSource.indexOf("\n}", start) + 2);
  const context = {
    constructedDecks: api, fourLaneDeckCatalog: catalog,
    fourLaneDeckEditor: { getSelectedDeck: () => store.getDeck() },
    isFourLaneMode: () => true, hideFourLanePreview: () => {}, stopTutorialMode: () => {},
    closeGameMenu: () => {}, setGameMenuVisibility: () => {}, state: { locked: false },
    document: { querySelector: () => ({}), body: { classList: { remove: () => {} } } },
    ui: { mainMenuScreen: {}, difficultyDialog: { open: true } },
  };
  runInNewContext(source, context);
  context.showDifficultyChooser("four-lane");
  const snapshot = context.matchFourLaneDeck;
  assert.equal(snapshot.name, "Rally run");
  assert.ok(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.cards));
  store.save(custom("Finisher replacement", starters[3]), saved.id);
  assert.deepEqual([...snapshot.cards], [...starters[1].cards]);
  context.showDifficultyChooser("game");
  assert.equal(context.matchFourLaneDeck, snapshot);
  context.showDifficultyChooser("main");
  assert.equal(context.pendingDuelMode, "normal");
});

test("the editor preserves safe text boundaries, accessible controls and dedicated packaging", () => {
  const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const source = readFileSync(new URL("../src/deck-editor.js", import.meta.url), "utf8");
  const packaging = readFileSync(new URL("../scripts/copy-static.js", import.meta.url), "utf8");
  const style = readFileSync(new URL("../deckbuilding.css", import.meta.url), "utf8");
  assert.ok(page.indexOf("./src/deckbuilding.js") < page.indexOf("./src/deck-editor.js"));
  assert.ok(page.indexOf("./src/deck-editor.js") < page.indexOf("./src/game.js"));
  assert.ok(packaging.includes('cp("src/deck-editor.js", "dist/src/deck-editor.js")'));
  assert.match(page, /id="deckEditorStatus" role="status" aria-live="polite"/);
  assert.match(page, /id="deckEditorConfirm" aria-labelledby="deckEditorConfirmTitle"/);
  assert.match(source, /element\.textContent = name/);
  assert.match(source, /deckEditorConfirmText\.textContent = text/);
  assert.match(source, /draft\.name = ui\.deckEditorName\.value/);
  assert.match(source, /deckEditorSaveButton\.disabled = !report\.valid/);
  assert.doesNotMatch(source, /\beval\(|new Function|fetch\(/);
  assert.match(style, /\.deck-catalog-card \.game-card \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(style, /\.deck-catalog-card \.game-card > :is\(\.card-art, \.card-info, \.card-ability\) \{ min-width: 0/);
  assert.match(style, /\.deck-catalog-card \.card-art img \{ position: absolute; inset: 0/);
});
