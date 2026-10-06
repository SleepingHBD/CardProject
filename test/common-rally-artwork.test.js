import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const artworkFolder = new URL("../assets/cards/four-lane/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("common-rally-artwork.json", artworkFolder), "utf8"));
const rareManifest = JSON.parse(readFileSync(new URL("rare-rally-artwork.json", artworkFolder), "utf8"));

test("Common Rally artwork preserves the three approved names, breeds and element assignments", () => {
  assert.deepEqual(manifest.cards.map(({ name, basedOn, gender, breed, element }) => ({ name, basedOn, gender, breed, element })), [
    { name: "Lucan Crustkeeper", basedOn: "Lucas", gender: "male", breed: "Singapura", element: "ember" },
    { name: "Jiawen Barleybreeze", basedOn: "Jia Wei", gender: "male", breed: "Korat", element: "gust" },
    { name: "Siewen Rainkeeper", basedOn: "Siew Hean", gender: "male", breed: "LaPerm", element: "tide" },
  ]);
  for (const card of manifest.cards) {
    assert.deepEqual(card.intendedStats, { rarity: "common", role: "rally", power: 4 });
    assert.ok(card.prompt.length > 1000);
    assert.match(card.anatomyReview, /Four feline limbs total/);
  }
  assert.match(manifest.generator, /Built-in ImageGen/);
});

test("the selected Siewen artwork is Rainkeeper, with the superseded Reedbinder design recorded separately", () => {
  const siewen = manifest.cards[2];
  assert.equal(siewen.asset, "siewen-rainkeeper.png");
  assert.equal(siewen.move, "Rainshare");
  assert.match(siewen.costumeDescription, /Broad-brimmed navy felt/);
  assert.match(siewen.prompt, /CERAMIC BASIN/);
  assert.match(siewen.prompt, /ONE SMALL pale-blue\/cream flat cartoon raincloud/);
  assert.match(siewen.cropReview, /Both eyes/);
  assert.equal(siewen.previousName, "Siewen Reedbinder");
  assert.equal(siewen.revisionHistory[0].asset, "siewen-reedbinder.png");
});

test("Common Rally PNG masters match the square dimensions of the existing Rally artwork", () => {
  assert.deepEqual(manifest.imageDimensions, rareManifest.imageDimensions);
  assert.equal(new Set(manifest.cards.map(card => card.asset)).size, 3);
  for (const card of manifest.cards) {
    assert.match(card.asset, /^[a-z-]+\.png$/);
    const bytes = readFileSync(new URL(card.asset, artworkFolder));
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.toString("ascii", 12, 16), "IHDR");
    assert.equal(bytes.readUInt32BE(16), manifest.imageDimensions.width);
    assert.equal(bytes.readUInt32BE(20), manifest.imageDimensions.height);
    assert.ok(bytes.length > 100000);
  }
});

test("Common Rally frames are preview-only and do not change the live three-lane card pool", () => {
  assert.match(manifest.status, /Framed card previews/);
  assert.match(manifest.status, /Rally gameplay is not active yet/);
  const gameSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
  const liveLibrary = gameSource.match(/const CARD_LIBRARY = \[([\s\S]*?)\]\.map/)[1];
  for (const card of manifest.cards) {
    assert.ok(!liveLibrary.includes(card.name));
    assert.ok(!liveLibrary.includes(card.asset.replace(/\.png$/, "")));
    assert.ok(gameSource.includes(card.name));
  }
  assert.ok(!gameSource.includes('"siewen-reedbinder"'));
  assert.match(gameSource, /const MAX_PLAY_SIZE = 3;/);
});
