import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const artworkFolder = new URL("../assets/cards/four-lane/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("uncommon-rally-artwork.json", artworkFolder), "utf8"));
const rareManifest = JSON.parse(readFileSync(new URL("rare-rally-artwork.json", artworkFolder), "utf8"));

test("Uncommon Rally artwork preserves the three approved character identities", () => {
  assert.deepEqual(manifest.cards.map(({ name, gender, breed, element }) => ({ name, gender, breed, element })), [
    { name: "Charmae", gender: "female", breed: "Havana Brown", element: "ember" },
    { name: "Aakith", gender: "male", breed: "American Curl", element: "gust" },
    { name: "Sajrin", gender: "male", breed: "Turkish Van", element: "tide" },
  ]);
  for (const card of manifest.cards) {
    assert.deepEqual(card.intendedStats, { rarity: "uncommon", role: "rally", power: 5 });
    assert.ok(card.prompt.length > 1000);
    assert.ok(card.styleRevisionPrompt.length > 1000);
  }
  assert.equal(manifest.styleReferences.length, 3);
});

test("Charmae's earlier name and Aakith's table, map, hind leg and matching tunic revisions are documented", () => {
  const [charmae, aakith] = manifest.cards;
  assert.equal(charmae.previousName, "Charmae Hearthstitch");
  assert.equal(charmae.asset, "charmae-emberhem.png");
  const tableRevision = aakith.revisionHistory.find(revision => revision.type === "level-table").prompt;
  assert.match(tableRevision, /LONG FRONT EDGE must run nearly HORIZONTAL/);
  assert.match(tableRevision, /parchment lies FLAT and flush on the tabletop plane/);
  assert.match(tableRevision, /narrow continuous wooden margin/);
  assert.ok(aakith.revisionHistory.some(revision => revision.type === "map-alignment"));
  const legRevision = aakith.revisionHistory.find(revision => revision.type === "connected-hind-leg").prompt;
  assert.match(legRevision, /continuous short silver-grey furry hind leg/);
  assert.match(aakith.latestRevisionPrompt, /SAME cream edging/);
  assert.match(aakith.costumeDescription, /above each hind leg/);
  assert.match(aakith.latestRevisionPrompt, /four paws total/);
  assert.match(aakith.anatomyReview, /four feline limbs total/);
});

test("Uncommon Rally masters are separate square PNGs matching the Rare master dimensions", () => {
  assert.deepEqual(manifest.imageDimensions, rareManifest.imageDimensions);
  assert.equal(new Set(manifest.cards.map(card => card.asset)).size, 3);
  for (const card of manifest.cards) {
    assert.match(card.asset, /^[a-z-]+\.png$/);
    const bytes = readFileSync(new URL(card.asset, artworkFolder));
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.toString("ascii", 12, 16), "IHDR");
    assert.equal(bytes.readUInt32BE(16), manifest.imageDimensions.width);
    assert.equal(bytes.readUInt32BE(20), manifest.imageDimensions.height);
    assert.ok(manifest.imageDimensions.width >= 768);
  }
});

test("Uncommon Rally artwork is framed without changing the live three-lane gameplay", () => {
  assert.match(manifest.status, /Framed card previews/);
  const gameSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
  const liveLibrary = gameSource.match(/const CARD_LIBRARY = \[([\s\S]*?)\]\.map/)[1];
  for (const card of manifest.cards) {
    assert.ok(!liveLibrary.includes(card.name));
    assert.ok(!liveLibrary.includes(card.asset.replace(/\.png$/, "")));
    assert.ok(gameSource.includes(card.name));
  }
  assert.match(gameSource, /const MAX_PLAY_SIZE = 3;/);
});
