import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const artworkFolder = new URL("../assets/cards/four-lane/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("rare-rally-artwork.json", artworkFolder), "utf8"));

test("the new Rare Rally artwork has the approved names and one character per element", () => {
  assert.deepEqual(manifest.cards.map(card => card.name), [
    "Megwyn", "Hareth", "Deshone",
  ]);
  assert.deepEqual(manifest.cards.map(card => card.element).sort(), ["ember", "gust", "tide"]);
  for (const card of manifest.cards) {
    assert.deepEqual(card.intendedStats, { rarity: "rare", role: "rally", power: 6 });
    assert.ok(card.prompt.length > 1000);
    assert.ok(card.revisionPrompt.length > 100);
  }
});

test("each final illustration is a separate, square production-resolution PNG", () => {
  const sizes = [];
  for (const card of manifest.cards) {
    assert.match(card.asset, /^[a-z-]+\.png$/);
    const bytes = readFileSync(new URL(card.asset, artworkFolder));
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.toString("ascii", 12, 16), "IHDR");
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    assert.equal(width, height);
    assert.ok(width >= 768);
    sizes.push(width);
  }
  assert.equal(new Set(sizes).size, 1);
  assert.equal(new Set(manifest.cards.map(card => card.asset)).size, 3);
});

test("Hareth and Deshone retain their approved costume revisions and Deshone's new breed", () => {
  const [megwyn, hareth, deshone] = manifest.cards;
  assert.equal(megwyn.breed, "Devon Rex");
  assert.equal(megwyn.latestRevisionPrompt, undefined);
  assert.equal(hareth.breed, "British Shorthair");
  assert.match(hareth.costumeDescription, /particoloured drummer's livery/);
  assert.equal(deshone.breed, "Somali");
  assert.match(deshone.costumeDescription, /spring-healer's wrap robe/);
  for (const card of [hareth, deshone]) {
    assert.ok(card.latestRevisionPrompt.length > 1000);
    assert.match(card.latestRevisionPrompt, /TWO (?:short )?hind legs/);
  }
});

test("new artwork is documented as isolated from the live three-lane card pool", () => {
  assert.match(manifest.status, /Framed card previews/);
  const gameSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
  const liveLibrary = gameSource.match(/const CARD_LIBRARY = \[([\s\S]*?)\]\.map/)[1];
  for (const card of manifest.cards) assert.ok(!liveLibrary.includes(card.name));
  assert.match(gameSource, /const MAX_PLAY_SIZE = 3;/);
});
