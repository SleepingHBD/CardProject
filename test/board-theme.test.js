import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const pageSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const gameSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

function sourceFunction(name) {
  const start = gameSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  const end = gameSource.indexOf("\n}", start);
  assert.notEqual(end, -1, `${name} should have a closing brace`);
  return gameSource.slice(start, end + 2);
}

const boardConstants = [
  gameSource.match(/const BOARD_THEMES = Object\.freeze\(\[[^\n]+\]\);/)?.[0],
  gameSource.match(/const BOARD_THEME_STORAGE_KEY = "[^"]+";/)?.[0],
].join("\n");

test("Board settings expose mutually exclusive Map and Tabletop choices", () => {
  assert.match(pageSource, /id="boardSettingsTab"[\s\S]*?data-settings-panel="board"[\s\S]*?aria-controls="boardSettingsPanel"/);
  assert.match(pageSource, /id="boardSettingsPanel"[\s\S]*?aria-labelledby="boardSettingsTab"/);
  assert.match(pageSource, /name="boardTheme" value="map"/);
  assert.match(pageSource, /name="boardTheme" value="tabletop"/);
  assert.match(gameSource, /if \(!option\.checked \|\| !BOARD_THEMES\.includes\(option\.value\)\) return;/);
});

test("V2 board themes are validated and Tabletop is the default", () => {
  assert.match(boardConstants, /Object\.freeze\(\["map", "tabletop"\]\)/);
  assert.match(boardConstants, /BOARD_THEME_STORAGE_KEY = "projectProwl\.boardThemeV2";/);
  const readTheme = (savedValue) => runInNewContext(
    `${boardConstants}\n${sourceFunction("readSavedBoardTheme")}\nreadSavedBoardTheme()`,
    { window: { localStorage: { getItem: (key) => {
      assert.equal(key, "projectProwl.boardThemeV2");
      return savedValue;
    } } } },
  );

  assert.equal(readTheme("tabletop"), "tabletop");
  assert.equal(readTheme("map"), "map");
  assert.equal(readTheme("other"), "tabletop");
  assert.equal(readTheme(""), "tabletop");
  assert.equal(readTheme(null), "tabletop");
  assert.equal(runInNewContext(
    `${boardConstants}\n${sourceFunction("readSavedBoardTheme")}\nreadSavedBoardTheme()`,
    { window: { get localStorage() { throw new Error("storage denied"); } } },
  ), "tabletop");
  assert.equal(runInNewContext(
    `${boardConstants}\n${sourceFunction("readSavedBoardTheme")}\nreadSavedBoardTheme()`,
    { window: { localStorage: { getItem() { throw new Error("storage denied"); } } } },
  ), "tabletop");
});

test("legacy auto-saved Map is ignored when the V2 preference is absent", () => {
  const stored = { "projectProwl.boardTheme": "map" };
  const readKeys = [];
  const theme = runInNewContext(
    `${boardConstants}\n${sourceFunction("readSavedBoardTheme")}\nreadSavedBoardTheme()`,
    { window: { localStorage: { getItem: (key) => {
      readKeys.push(key);
      return stored[key] ?? null;
    } } } },
  );

  assert.equal(theme, "tabletop");
  assert.deepEqual(readKeys, ["projectProwl.boardThemeV2"]);
});

test("board setting applies the root theme and selected radio immediately", () => {
  const options = [{ value: "map", checked: true }, { value: "tabletop", checked: false }];
  const root = { dataset: {} };
  const status = { textContent: "" };
  const context = {
    state: { boardTheme: "tabletop" },
    document: {
      documentElement: root,
      querySelectorAll: (selector) => {
        assert.equal(selector, 'input[name="boardTheme"]');
        return options;
      },
    },
    ui: { boardSettingsStatus: status },
  };
  runInNewContext(`${sourceFunction("renderBoardSettings")}\nrenderBoardSettings(false)`, context);

  assert.equal(root.dataset.boardTheme, "tabletop");
  assert.deepEqual(options.map(({ checked }) => checked), [false, true]);
  assert.match(status.textContent, /Tabletop is selected for this session/);
});

test("board setting is saved on startup and when the choice changes", () => {
  assert.match(gameSource, /boardTheme: readSavedBoardTheme\(\)/);
  assert.match(gameSource, /renderBoardSettings\(saveBoardTheme\(state\.boardTheme\)\)/);
  assert.match(gameSource, /saveBoardTheme\(state\.boardTheme\),\s*\);/);

  const saved = [];
  const result = runInNewContext(
    `${boardConstants}\n${sourceFunction("saveBoardTheme")}\nsaveBoardTheme("tabletop")`,
    { window: { localStorage: { setItem: (...args) => saved.push(args) } } },
  );
  assert.equal(result, true);
  assert.deepEqual(saved, [["projectProwl.boardThemeV2", "tabletop"]]);
});

test("Tabletop hides the idle VS seal while keeping the round score", () => {
  assert.match(stylesSource, /\[data-board-theme="tabletop"\] \.duel-table \.versus-badge:not\(\.has-score\) \{\s*display: none;/);
  assert.match(sourceFunction("resolveRound"), /ui\.versusBadge\.className = "versus-badge has-score";/);
  assert.match(sourceFunction("resolveTutorialRound"), /ui\.versusBadge\.className = "versus-badge has-score";/);
});

test("Tabletop keeps the painted surface inside a consistent wood-and-gold frame", () => {
  assert.ok(existsSync(new URL("../assets/backgrounds/whiskerkeep-table-v2.webp", import.meta.url)));
  assert.match(stylesSource, /\[data-board-theme="tabletop"\] \.arena\.duel-table \{[^}]*background: url\("assets\/backgrounds\/whiskerkeep-table-v2\.webp"\) center \/ 125% 125% no-repeat/);
  assert.match(stylesSource, /\[data-board-theme="tabletop"\] \.arena\.duel-table::before \{[^}]*display: block;[^}]*border: var\(--table-frame-width\) solid #5b3824;[^}]*box-shadow: inset 0 0 0 1px #d6a460/);
  assert.doesNotMatch(stylesSource, /border-image: url\("assets\/backgrounds\/whiskerkeep-table-v2\.webp"\)/);
  assert.doesNotMatch(stylesSource, /whiskerkeep-table-v1\.webp/);
  assert.match(stylesSource, /\.board-theme-option:has\(input\[value="tabletop"\]\) \.clash-style-seal \{[^}]*border: 3px solid #5b3824/);
  assert.match(stylesSource, /\.formation-slot\.empty-slot:not\(\.next-slot\):not\(\.drag-over\)/);
  assert.match(pageSource, /illustrated painted board/);
});

test("Tabletop scales the frame, not the card zones", () => {
  assert.doesNotMatch(stylesSource, /\[data-board-theme="tabletop"\] \.duel-table \.battlefield \{\s*padding/);
  assert.match(stylesSource, /--table-frame-width: clamp\(3px, \.55vw, 7px\);/);
  assert.match(stylesSource, /@media \(orientation: landscape\) and \(max-width: 1024px\) and \(max-height: 600px\) \{\s*\[data-board-theme="tabletop"\] \.arena\.duel-table \{\s*--table-frame-width: 3px;/);
});

test("Tabletop separates the two play areas with an inlaid hairline", () => {
  assert.match(stylesSource, /\[data-board-theme="tabletop"\] \.duel-table \.battlefield::before \{[^}]*height: 1px;[^}]*border: 0;[^}]*box-shadow: none;/);
  assert.match(stylesSource, /\.duel-table \.battlefield:has\(\.opponent-zone \.card-placeholder\)::before \{\s*top: 57px;/);
});

test("Tabletop tints only the structural board-control divider", () => {
  assert.match(stylesSource, /\.hand \{[^}]*border-top: 2px solid #b17b3c;/);
  assert.match(stylesSource, /\[data-board-theme="tabletop"\] \.arena\.duel-table \{[^}]*border-right-color: #b17b3c;/);
  assert.doesNotMatch(stylesSource, /\[data-board-theme="tabletop"\] \.arena\.duel-table::before \{\s*border-right-color:/);
  assert.doesNotMatch(stylesSource, /--table-outer-right: 4px;/);
});
