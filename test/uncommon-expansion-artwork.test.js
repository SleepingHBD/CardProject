import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const artworkFolder = new URL("../assets/cards/four-lane/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("uncommon-expansion-artwork.json", artworkFolder), "utf8"));
const gameSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");

test("the additional Uncommon artwork preserves the approved friends, breeds and role gaps", () => {
  assert.deepEqual(manifest.cards.map(({ name, basedOn, breed, element, intendedStats }) => ({ name, basedOn, breed, element, intendedStats })), [
    { name: "Shazmir Ashveil", basedOn: "Shazmeer", breed: "Lykoi", element: "ember", intendedStats: { rarity: "uncommon", role: "link", power: 5 } },
    { name: "Hidayn Windbrace", basedOn: "Hidayat", breed: "Scottish Fold", element: "gust", intendedStats: { rarity: "uncommon", role: "vanguard", power: 5 } },
    { name: "Isai Tidebind", basedOn: "Isaiah", breed: "Snowshoe", element: "tide", intendedStats: { rarity: "uncommon", role: "finisher", power: 5 } },
  ]);
  assert.match(manifest.generator, /Built-in ImageGen/);
  assert.equal(manifest.styleReferences.length, 4);
  for (const reference of manifest.styleReferences) assert.ok(readFileSync(new URL(`../${reference}`, import.meta.url)).length > 1000);
  for (const card of manifest.cards) {
    assert.ok(card.prompt.length > 1000);
    assert.match(card.anatomyReview, /Four feline limbs total/);
  }
});

test("new Uncommon PNG masters match the existing square Rally master dimensions", () => {
  const currentManifest = JSON.parse(readFileSync(new URL("common-rally-artwork.json", artworkFolder), "utf8"));
  assert.deepEqual(manifest.imageDimensions, currentManifest.imageDimensions);
  assert.equal(new Set(manifest.cards.map(card => card.asset)).size, 3);
  for (const card of manifest.cards) {
    const bytes = readFileSync(new URL(card.asset, artworkFolder));
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.toString("ascii", 12, 16), "IHDR");
    assert.equal(bytes.readUInt32BE(16), 1254);
    assert.equal(bytes.readUInt32BE(20), 1254);
    assert.ok(bytes.length > 100000);
  }
});

test("the wave-rider and glider redesigns retain their exact original drafts", () => {
  assert.equal(manifest.version, 4);
  const hidayn = manifest.cards.find(card => card.name === "Hidayn Windbrace");
  const isai = manifest.cards.find(card => card.name === "Isai Tidebind");
  assert.match(hidayn.characterDescription, /glider soldier/);
  assert.match(hidayn.redesignPrompt, /glider soldier/i);
  assert.match(hidayn.latestRevisionPrompt, /wing tips/i);
  assert.match(hidayn.costumeDescription, /wood-and-linen/);
  assert.equal(hidayn.move, "Firstwind Descent");
  assert.match(isai.characterDescription, /wave-rider/);
  assert.match(isai.latestRevisionPrompt, /surfing/i);
  assert.match(isai.poseDescription, /two white hind paws planted/);
  assert.equal(isai.move, "Closing Current");
  const expectedBackups = [
    [hidayn, "hidayn-windbrace-crossbow-sentry.png", "5c8ec8f6edb4af14eb4c60389aab39ac49d64f1ead19df80e7b51c8b038b868c"],
    [isai, "isai-tidebind-net-fighter.png", "cf63cd0c711232e07f34a671e76ff681b4886e6139a6e3034d59e0f285086484"],
  ];
  for (const [card, asset, digest] of expectedBackups) {
    assert.ok(card.revisionHistory.some(revision => revision.asset === asset));
    const backup = readFileSync(new URL(asset, artworkFolder));
    assert.equal(createHash("sha256").update(backup).digest("hex"), digest);
    assert.notDeepEqual(readFileSync(new URL(card.asset, artworkFolder)), backup);
  }
});

test("Shazmir's selected grip correction preserves the original and excludes the rejected reverse hold", () => {
  const shazmir = manifest.cards.find(card => card.name === "Shazmir Ashveil");
  const preserved = shazmir.revisionHistory.find(revision => revision.type === "original-grip-preserved");
  assert.equal(preserved.asset, "shazmir-ashveil-original-grip.png");
  const backup = readFileSync(new URL(preserved.asset, artworkFolder));
  assert.equal(createHash("sha256").update(backup).digest("hex"), "1e878708fc9bfc6b2c8db243c24e0fe85e4dd588c92bc7ab6b99b9242af7292d");
  assert.notDeepEqual(readFileSync(new URL(shazmir.asset, artworkFolder)), backup);
  assert.match(shazmir.latestRevisionPrompt, /NORMAL UPRIGHT FOLDING-FAN GRIP/);
  assert.match(shazmir.latestRevisionPrompt, /NOT a reverse grip/);
  const rejected = shazmir.revisionHistory.find(revision => revision.type === "fan-grip-reverse-hold-rejected");
  assert.ok(rejected);
  assert.notEqual(shazmir.generationSource, rejected.source);
  assert.notEqual(shazmir.generationSource, preserved.source);
  assert.equal(shazmir.asset, "shazmir-ashveil.png");
  assert.deepEqual(shazmir.intendedStats, { rarity: "uncommon", role: "link", power: 5 });
});

test("the three framed previews fill the missing non-Rally role per element without changing normal gameplay", () => {
  const context = {};
  const librarySource = gameSource.slice(gameSource.indexOf("const CARD_LIBRARY ="), gameSource.indexOf("const HAND_SIZE ="));
  runInNewContext(librarySource + "\nglobalThis.library = CARD_LIBRARY;", context);
  assert.equal(context.library.length, 24);
  assert.match(manifest.status, /Framed in the Four-Lane Mode card preview/);
  assert.match(manifest.status, /not registered in the live three-lane game/);
  assert.match(gameSource, /const MAX_PLAY_SIZE = 3;/);
  for (const card of manifest.cards) {
    assert.ok(!librarySource.includes(card.name));
    assert.ok(!librarySource.includes(card.asset.replace(/\.png$/, "")));
  }
  const proposed = [...context.library, ...manifest.cards.map(card => ({ element: card.element, tactic: card.intendedStats.role }))];
  for (const element of ["ember", "gust", "tide"]) {
    for (const role of ["vanguard", "link", "finisher"]) {
      assert.equal(proposed.filter(card => card.element === element && card.tactic === role).length, 3);
    }
  }
});
