import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const folder = new URL("../assets/cards/four-lane/", import.meta.url);
const polish = JSON.parse(readFileSync(new URL("background-and-framing-polish.json", folder), "utf8"));
const css = readFileSync(new URL("../four-lane-preview.css", import.meta.url), "utf8");
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

test("Isai and Sajrin use artwork-only framing without regenerating their illustrations", () => {
  for (const adjustment of polish.frameOnlyAdjustments) {
    assert.equal(sha256(readFileSync(new URL(`${adjustment.template}.png`, folder))), adjustment.imageSha256);
  }
  const isai = css.match(/\.game-card\[data-card-template="isai-tidebind"\] \.card-art img \{\s*transform:([^}]+)\}/);
  assert.ok(isai, "Isai's offset must apply to previews, deckbuilding and gameplay");
  assert.match(isai[1], /translateX\(-3%\) scale\(1\.06\)/);
  assert.doesNotMatch(isai[1], /(?:width|height):/);
  const sajrin = css.match(/\.game-card\[data-card-template="sajrin-shellwright"\] \.card-art img \{([^}]+)\}/);
  assert.ok(sajrin, "Sajrin's crop must apply to previews, deckbuilding and gameplay");
  assert.match(sajrin[1], /object-position: center top/);
  assert.doesNotMatch(sajrin[1], /(?:width|height):/);
  assert.doesNotMatch(css, /body\[data-duel-mode="four-lane"\] \.game-card\[data-card-template="sajrin-shellwright"\]/,
    "The gameplay default must not override Sajrin's adjusted crop");
});

test("Fire background edits preserve exact original masters and square asset dimensions", () => {
  assert.deepEqual(polish.cards.map(card => card.name), ["Lucan", "Charmae", "Shazmir"]);
  for (const card of polish.cards) {
    const original = readFileSync(new URL(card.preservedOriginal, folder));
    const current = readFileSync(new URL(card.asset, folder));
    assert.equal(sha256(original), card.originalSha256);
    assert.equal(sha256(current), card.currentSha256);
    assert.notDeepEqual(current, original);
    for (const bytes of [original, current]) {
      assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      assert.equal(bytes.readUInt32BE(16), 1254);
      assert.equal(bytes.readUInt32BE(20), 1254);
    }
    assert.match(card.prompt, /OUTER BACKDROP/);
    assert.match(card.prompt, /Do not recolour any white\/cream fur/);
  }
});
