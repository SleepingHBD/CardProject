import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

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
});
