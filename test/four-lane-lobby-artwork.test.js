import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";

const layout = readFileSync(new URL("../four-lane-preview.css", import.meta.url), "utf8");
const lobby = readFileSync(new URL("../deckbuilding.css", import.meta.url), "utf8");
const packaging = readFileSync(new URL("../scripts/copy-static.js", import.meta.url), "utf8");
const artworkPath = "./assets/backgrounds/four-lane-lobby-courtyard.png";

function rule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  assert.ok(match, `Missing ${selector} rule`);
  return match[1];
}

test("the production courtyard uses the fur-corrected render at its original dimensions", () => {
  const image = readFileSync(new URL(`../${artworkPath}`, import.meta.url));
  assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(image.readUInt32BE(16), 1672);
  assert.equal(image.readUInt32BE(20), 941);
  assert.equal(createHash("sha256").update(image).digest("hex"),
    "573663d288201d8b2b75fb4eeb71a27234d804b7446b59d4dc81b232a2279f96");
});

test("the style-match keeps the exact previous courtyard and main-menu reference intact", () => {
  const history = JSON.parse(readFileSync(new URL("../assets/backgrounds/four-lane-courtyard-draft-v7.json", import.meta.url), "utf8"));
  assert.equal(history.productionAsset, "four-lane-lobby-courtyard.png");
  assert.match(history.generator, /Built-in ImageGen/);
  assert.match(history.prompt, /STYLE REFERENCE ONLY/);
  for (const reference of history.references) {
    const source = readFileSync(new URL(`../${reference.path}`, import.meta.url));
    assert.equal(createHash("sha256").update(source).digest("hex"), reference.sha256);
    assert.equal(source.readUInt32BE(16), 1672);
    assert.equal(source.readUInt32BE(20), 941);
  }
  const master = readFileSync(new URL(`../assets/backgrounds/${history.asset}`, import.meta.url));
  assert.equal(createHash("sha256").update(master).digest("hex"), history.sha256);
});

test("Gale's fur correction preserves the previous courtyard and original card reference", () => {
  const history = JSON.parse(readFileSync(new URL("../assets/backgrounds/four-lane-courtyard-draft-v8.json", import.meta.url), "utf8"));
  assert.equal(history.productionAsset, "four-lane-lobby-courtyard.png");
  assert.equal(history.preservedPreviousDraft, "four-lane-courtyard-draft-v7.png");
  assert.match(history.generator, /Built-in ImageGen/);
  assert.match(history.prompt, /FUR-COLOUR REFERENCE ONLY/);
  assert.deepEqual(history.references.map(reference => reference.path), [
    "assets/backgrounds/four-lane-courtyard-draft-v7.png", "assets/cards/gale-groomer.webp",
  ]);
  for (const reference of history.references) {
    const source = readFileSync(new URL(`../${reference.path}`, import.meta.url));
    assert.equal(createHash("sha256").update(source).digest("hex"), reference.sha256);
  }
  const production = readFileSync(new URL(`../${artworkPath}`, import.meta.url));
  const master = readFileSync(new URL(`../assets/backgrounds/${history.asset}`, import.meta.url));
  assert.deepEqual(production, master);
  assert.equal(createHash("sha256").update(master).digest("hex"), history.sha256);
});

test("the artwork is a portable, cover-sized background scoped to the lobby only", () => {
  const screen = rule(layout, ".four-lane-preview-screen");
  assert.ok(screen.includes(`url("${artworkPath}")`));
  assert.match(screen, /center center \/ cover no-repeat/);
  assert.doesNotMatch(screen, /(?:linear|radial)-gradient|filter\s*:/);
  assert.match(screen, /#251b17/);
  assert.match(screen, /overflow:\s*auto/);
  assert.match(screen, /safe-area-inset/);
  assert.equal(layout.split(artworkPath).length - 1, 1);
  assert.doesNotMatch(layout, /four-lane-courtyard-draft/);
  assert.doesNotMatch(lobby, /four-lane-lobby-courtyard/);
});

test("both lobby steps and their expanded help retain warm brown readable surfaces", () => {
  for (const selector of [".four-lane-lobby-steps", ".four-lane-deck-choice",
    ".four-lane-rival-heading", ".four-lane-rival-choice", ".four-lane-basics"]) {
    assert.match(rule(lobby, selector), /background:\s*#251b17ed/);
  }
  for (const selector of [".four-lane-card-showcase", ".four-lane-preview-notice"]) {
    assert.match(rule(layout, selector), /background:\s*#251b17ed/);
  }
  assert.match(lobby, /\.four-lane-starter-option:has\(input:checked\)/);
  assert.match(lobby, /\.four-lane-rival-option:has\(input:focus-visible\)/);
  assert.match(lobby, /\.four-lane-lobby-page\[hidden\]\s*\{\s*display:\s*none/);
});

test("lobby controls preserve the original brown-and-gold palette without a blue artwork tint", () => {
  assert.match(rule(lobby, ".four-lane-starter-option"), /background:\s*#33241c/);
  assert.match(rule(lobby, ".four-lane-starter-option:has(input:checked)"), /background:\s*#493323/);
  assert.match(rule(lobby, ".four-lane-rival-option"), /background:\s*#30231c/);
  assert.match(rule(lobby, ".four-lane-rival-option:has(input:checked)"), /background:\s*#4b3623/);
  assert.match(rule(layout, ".four-lane-preview-header"), /#2f211df0, #1f1615e6/);
  assert.doesNotMatch(layout + lobby, /#(?:080d18|111725|131925|1c2533|252e3c|303b4b|354153|1d2532|273242)/i);
});

test("static packaging includes the approved release asset but excludes preview drafts", () => {
  const filter = packaging.match(/filter:\s*(\(source\) => [\s\S]*?),\n/);
  assert.ok(filter, "Static asset filter is present");
  const include = runInNewContext(`(${filter[1]})`);
  assert.equal(include("assets/backgrounds/four-lane-lobby-courtyard.png"), true);
  assert.equal(include("assets/backgrounds/main-menu-sir-squall-vs-comet-claw.png"), true);
  for (const version of [1, 2, 3, 4, 5, 6, 7, 8]) {
    assert.equal(include(`assets/backgrounds/four-lane-courtyard-draft-v${version}.png`), false);
    assert.equal(include(`assets\\backgrounds\\four-lane-courtyard-draft-v${version}.json`), false);
  }
  assert.equal(include("assets/cards/example.new-art.webp"), false);
});
