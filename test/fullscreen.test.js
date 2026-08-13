import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const gameSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");

test("fullscreen can be toggled from the main menu and the in-game menu", () => {
  assert.match(pageSource, /id="mainMenuFullscreenButton"[\s\S]*?aria-pressed="false"/);
  assert.match(pageSource, /id="gameFullscreenButton"[\s\S]*?aria-pressed="false"/);
  assert.match(gameSource, /ui\.mainMenuFullscreenButton\.addEventListener\("click", toggleFullscreen\)/);
  assert.match(gameSource, /ui\.gameFullscreenButton\.addEventListener\("click", toggleFullscreen\)/);
});

test("fullscreen behavior supports entering, exiting, and browser-prefixed fallbacks", () => {
  assert.match(gameSource, /function toggleFullscreen\(\)/);
  assert.match(gameSource, /root\.requestFullscreen\(\{ navigationUI: "hide" \}\)/);
  assert.match(gameSource, /document\.exitFullscreen\(\)/);
  assert.match(gameSource, /root\.webkitRequestFullscreen\(\)/);
  assert.match(gameSource, /document\.webkitExitFullscreen\(\)/);
});

test("fullscreen controls follow browser state and expose unsupported browsers", () => {
  assert.match(gameSource, /function renderFullscreenControls\(statusMessage = ""\)/);
  assert.match(gameSource, /button\.setAttribute\("aria-pressed", String\(active\)\)/);
  assert.match(gameSource, /button\.disabled = !available/);
  assert.match(gameSource, /document\.addEventListener\("fullscreenchange"/);
  assert.match(gameSource, /document\.addEventListener\("webkitfullscreenchange"/);
  assert.match(gameSource, /document\.addEventListener\("fullscreenerror"/);
});

test("touch-first tablets disable native card dragging so slight finger movement still taps", () => {
  assert.match(gameSource, /const touchFirstInput = window\.matchMedia/);
  assert.match(gameSource, /button\.draggable = !touchFirstInput\?\.matches/);
  assert.match(gameSource, /event\.pointerType === "touch"[\s\S]*?button\.draggable = false/);
  assert.match(gameSource, /card\.draggable = !touchFirstInput\.matches/);
  assert.match(gameSource, /touchFirstInput\?\.addEventListener\?\.\("change"/);
});
