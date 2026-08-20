import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const viewportSource = readFileSync(new URL("../src/viewport.js", import.meta.url), "utf8");

test("the page opts into notched-device safe areas", () => {
  assert.match(
    pageSource,
    /name="viewport" content="width=device-width, initial-scale=1\.0, viewport-fit=cover"/,
  );
  assert.match(styleSource, /env\(safe-area-inset-left\)/);
  assert.match(styleSource, /env\(safe-area-inset-right\)/);
  assert.match(styleSource, /env\(safe-area-inset-bottom\)/);
});

test("short landscape screens use a height-led gameplay grid", () => {
  const landscapeRules = styleSource.match(
    /\/\* -+\n   Landscape play surfaces[\s\S]*$/,
  )?.[0];

  assert.ok(landscapeRules, "landscape play-surface rules should exist");
  assert.match(
    landscapeRules,
    /@media \(orientation: landscape\) and \(max-width: 1024px\) and \(max-height: 600px\)/,
  );
  assert.match(landscapeRules, /\.hand-section \{\s*display: contents;/);
  assert.match(landscapeRules, /\.arena \{[\s\S]*?grid-column: 1;[\s\S]*?grid-row: 2;/);
  assert.match(landscapeRules, /\.control-panel \{[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 2;/);
  assert.match(landscapeRules, /\.hand \{[\s\S]*?grid-column: 1 \/ -1;[\s\S]*?grid-row: 3;/);
  assert.match(landscapeRules, /grid-template-rows: 27px minmax\(0, 1fr\) 96px;/);
});

test("the duel follows the live iOS viewport instead of leaving unused space", () => {
  assert.match(pageSource, /<script defer src="\.\/src\/viewport\.js"><\/script>/);
  assert.match(styleSource, /--app-viewport-height: 100dvh;/);
  assert.match(styleSource, /html \{\s*background: #3e423f;/);
  assert.match(
    styleSource,
    /html,\s*body \{[\s\S]*?height: var\(--app-viewport-height, 100dvh\);[\s\S]*?overscroll-behavior: none;/,
  );
  assert.match(styleSource, /body \{[\s\S]*?display: flex;[\s\S]*?flex-direction: column;/);
  assert.match(styleSource, /main \{[\s\S]*?flex: 1 1 auto;[\s\S]*?height: auto;/);
  assert.match(viewportSource, /Math\.max\([\s\S]*?window\.innerHeight[\s\S]*?root\.clientHeight[\s\S]*?viewport\?\.height/);
  assert.match(viewportSource, /viewport\?\.addEventListener\("resize", queueViewportUpdate/);
});

test("landscape tablets preserve the roomy board and coarse-pointer controls", () => {
  assert.match(
    styleSource,
    /@media \(orientation: landscape\) and \(min-width: 900px\) and \(min-height: 601px\) and \(max-width: 1366px\)/,
  );
  assert.match(
    styleSource,
    /@media \(orientation: landscape\) and \(hover: none\) and \(pointer: coarse\)/,
  );
  assert.match(styleSource, /-webkit-tap-highlight-color: transparent;/);
  assert.match(styleSource, /\.top-actions button,[\s\S]*?min-height: 44px;/);
  assert.match(styleSource, /\.hand \.game-card\[data-card-id\],[\s\S]*?touch-action: manipulation;/);
  assert.match(styleSource, /-webkit-user-drag: none;/);
});

test("short landscape menus anchor music credits to the bottom-left", () => {
  const landscapeRules = styleSource.match(
    /\/\* -+\n   Landscape play surfaces[\s\S]*$/,
  )?.[0];

  assert.ok(landscapeRules, "landscape play-surface rules should exist");
  assert.match(landscapeRules, /\.main-menu-screen \{[\s\S]*?grid-template-rows: auto auto auto auto;/);
  assert.match(landscapeRules, /\.main-menu-actions \{[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 1 \/ span 4;/);
  assert.match(
    landscapeRules,
    /\.main-menu-music-credit \{[\s\S]*?position: absolute;[\s\S]*?bottom: max\(8px, env\(safe-area-inset-bottom\)\);[\s\S]*?left: max\(10px, env\(safe-area-inset-left\)\);/,
  );
});
