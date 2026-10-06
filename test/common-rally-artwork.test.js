import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const artworkFolder = new URL("../assets/cards/four-lane/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("common-rally-artwork.json", artworkFolder), "utf8"));
const rareManifest = JSON.parse(readFileSync(new URL("rare-rally-artwork.json", artworkFolder), "utf8"));

test("Common Rally artwork preserves the three approved names, breeds and element assignments", () => {
  assert.deepEqual(manifest.cards.map(({ name, basedOn, gender, breed, element }) => ({ name, basedOn, gender, breed, element })), [
    { name: "Lucan", basedOn: "Lucas", gender: "male", breed: "Singapura", element: "ember" },
    { name: "Jyawaye", basedOn: "Jia Wei", gender: "male", breed: "Korat", element: "gust" },
    { name: "Siewen", basedOn: "Siew Hean", gender: "male", breed: "LaPerm", element: "tide" },
  ]);
  for (const card of manifest.cards) {
    assert.deepEqual(card.intendedStats, { rarity: "common", role: "rally", power: 4 });
    assert.ok(card.prompt.length > 1000);
    assert.match(card.anatomyReview, /Four feline limbs total/);
  }
  assert.match(manifest.generator, /Built-in ImageGen/);
});

test("Lucan's current design is Cinderclay, with the old baker retained only as artwork history", () => {
  const lucan = manifest.cards[0];
  assert.equal(lucan.asset, "lucan-cinderclay.png");
  assert.equal(lucan.move, "Kilnkindle");
  assert.equal(lucan.lore, "Small cups. Warm company.");
  assert.match(lucan.characterDescription, /Singapura village potter/);
  assert.match(lucan.costumeDescription, /terracotta-red/);
  assert.match(lucan.prompt, /pottery wheel/);
  assert.match(lucan.prompt, /CLAY CUP/);
  assert.equal(lucan.previousName, "Lucan Crustkeeper");
  assert.equal(lucan.revisionHistory[0].asset, "lucan-crustkeeper.png");
  const gameSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
  assert.doesNotMatch(gameSource, /Lucan Crustkeeper|lucan-crustkeeper|Warm Welcome/);
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

test("Siewen's seated rain-watching pose preserves his identity and original artwork", () => {
  const siewen = manifest.cards[2];
  assert.match(siewen.poseDescription, /Low seated right-facing three-quarter pose/);
  assert.match(siewen.poseDescription, /amber eyes looking upward/);
  assert.match(siewen.latestRevisionPrompt, /exactly TWO short connected forelegs and TWO short connected hind legs/);
  assert.match(siewen.latestRevisionPrompt, /The SAME blue ceramic basin with cream rim/);
  assert.match(siewen.latestRevisionPrompt, /The SAME short navy medieval tunic/);
  assert.deepEqual(siewen.poseReferenceImages, ["assets/cards/four-lane/siewen-rainkeeper-original-pose.png"]);
  assert.match(siewen.poseGenerationSource, /Built-in ImageGen/);
  const backup = siewen.revisionHistory.at(-1);
  assert.equal(backup.asset, "siewen-rainkeeper-original-pose.png");
  const previousArtwork = readFileSync(new URL(backup.asset, artworkFolder));
  const currentArtwork = readFileSync(new URL(siewen.asset, artworkFolder));
  assert.notDeepEqual(currentArtwork, previousArtwork);
  assert.equal(previousArtwork.readUInt32BE(16), 1254);
  assert.equal(previousArtwork.readUInt32BE(20), 1254);
  assert.deepEqual(siewen.intendedStats, { rarity: "common", role: "rally", power: 4 });
});

test("Lucan's side-on working pose retains his design and Jyawaye keeps his original artwork", () => {
  const lucan = manifest.cards[0];
  assert.match(lucan.poseDescription, /Left-facing side-on seated working pose/);
  assert.match(lucan.poseDescription, /green eyes looking down/);
  assert.match(lucan.proportionRefinementPrompt, /exactly TWO coherent hind legs/);
  assert.match(lucan.proportionRefinementPrompt, /NEAR HIND LEG AND PAW/);
  assert.match(lucan.farHindLegAttachmentPrompt, /anatomical RIGHT hind paw/);
  assert.match(lucan.farHindLegAttachmentPrompt, /ONE SHORT, slim, folded sepia lower leg/);
  assert.match(lucan.farHindLegAttachment, /short tapered ankle/);
  assert.match(lucan.costumeDescription, /original small cream folded linen work cap is restored/);
  assert.match(lucan.headgearRestoration, /both ears and eyes remain visible/);
  assert.match(lucan.headgearRestorationPrompt, /HEADGEAR REFERENCE ONLY/);
  assert.match(lucan.headgearRestorationPrompt, /preserve this corrected connection exactly/);
  assert.match(lucan.capEarSeparation, /distinct warm-black contour/);
  assert.match(lucan.capEarSeparationPrompt, /band BEHIND the near ear/);
  assert.match(lucan.capBandTrim, /stops before the near ear's dark-brown rim/);
  assert.match(lucan.capBandTrimPrompt, /TRIM BACK/);
  assert.match(lucan.capBandTrimPrompt, /about 50-60 pixels/);
  assert.match(lucan.capBandFit, /without cloth inside or beneath the ear/);
  assert.match(lucan.capBandFitPrompt, /about 15-20 pixels/);
  assert.match(lucan.capBandFitPrompt, /FLUSH against the OUTSIDE LEFT contour/);
  assert.match(lucan.apronStrapCorrection, /Both shoulder straps now match/);
  assert.match(lucan.costumeDescription, /matching cream-white shoulder straps/);
  assert.match(lucan.strapRecolourPrompt, /RIGHT shoulder strap of his apron from red to CREAM-WHITE/);
  assert.match(lucan.apronStrapJunction, /ends at the top seam/);
  assert.match(lucan.latestRevisionPrompt, /REMOVE the little WHITE RECTANGULAR PATCH/);
  assert.equal(lucan.strapJunctionRejectedPrompts.length, 2);
  assert.match(lucan.proportionRefinement, /reduced its oversized foreground paw/);
  assert.match(lucan.anatomyCorrection, /Removed the separate sepia knee\/leg projection/);
  assert.match(lucan.rejectedRevisionPrompts[0].reason, /three hind legs/);
  assert.equal(lucan.revisionHistory.at(-1).asset, "lucan-cinderclay-front-pose.png");
  const previousArtwork = readFileSync(new URL(lucan.revisionHistory.at(-1).asset, artworkFolder));
  const currentArtwork = readFileSync(new URL(lucan.asset, artworkFolder));
  assert.notDeepEqual(currentArtwork, previousArtwork);
  assert.equal(manifest.cards[1].asset, "jiawen-barleybreeze.png");
  assert.match(manifest.cards[1].prompt, /low braced three-quarter feline stance/);
  assert.match(manifest.cards[1].latestRevisionPrompt, /same two supporting|both paw contacts/);
  assert.deepEqual(lucan.intendedStats, { rarity: "common", role: "rally", power: 4 });
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
