import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";

const pageSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const gameSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const teapotPhoto = new URL(
  "../assets/cards/photographic/teapot-tabby-bell.jpg",
  import.meta.url,
);
const cinderPhoto = new URL(
  "../assets/cards/photographic/cinder-shiopan.png",
  import.meta.url,
);

test("settings offer persistent illustrated and photographic card artwork", () => {
  assert.match(pageSource, /id="artworkSettingsTab"[\s\S]*?Card Artwork/);
  assert.match(pageSource, /name="artworkStyle" value="illustrated"/);
  assert.match(pageSource, /name="artworkStyle" value="photographic"/);
  assert.match(gameSource, /projectProwl\.artworkStyle/);
  assert.match(gameSource, /saveArtworkStyle\(state\.artworkStyle\)/);
});

test("Teapot Tabby uses Bell's photograph with illustrated fallback support", () => {
  assert.ok(statSync(teapotPhoto).size > 100_000);
  assert.match(
    gameSource,
    /"teapot-tabby": "\.\/assets\/cards\/photographic\/teapot-tabby-bell\.jpg"/,
  );
  assert.match(gameSource, /PHOTOGRAPHIC_CARD_ART\[cardArt\]/);
  assert.match(gameSource, /`\.\/assets\/cards\/\$\{cardArt\}\.webp`/);
  assert.match(styleSource, /\.art-teapot-tabby\.uses-photographic-art \.card-art img/);
  assert.match(styleSource, /transform: translateX\(15%\)/);
});

test("Bell's photographic card uses its mode-specific character name", () => {
  assert.match(
    gameSource,
    /const PHOTOGRAPHIC_CARD_NAMES = Object\.freeze\(\{[\s\S]*?"teapot-tabby": "Peasant Bell"/,
  );
  assert.match(gameSource, /function cardDisplayName\(card\)/);
  assert.match(gameSource, /PHOTOGRAPHIC_CARD_NAMES\[card\.art\] \|\| card\.name/);
  assert.match(gameSource, /<strong>\$\{displayName\}<\/strong>/);
  assert.match(gameSource, /cardDisplayName\(a\)\.localeCompare\(cardDisplayName\(b\)\)/);
});

test("Cinder Kit uses Shiopan's photographic portrait and name", () => {
  assert.ok(statSync(cinderPhoto).size > 1_000_000);
  assert.match(
    gameSource,
    /"cinder-kit": "\.\/assets\/cards\/photographic\/cinder-shiopan\.png"/,
  );
  assert.match(gameSource, /"cinder-kit": "Cinder Shiopan"/);
  assert.match(styleSource, /\.art-cinder-kit\.uses-photographic-art \.card-art img/);
  assert.match(styleSource, /object-position: center top/);
});

test("Peasant Bell keeps a complete foreground frame around its shifted portrait", () => {
  assert.match(
    styleSource,
    /\.art-teapot-tabby\.uses-photographic-art \.card-art::after[\s\S]*?box-shadow: inset 0 0 0 1px #d0aa59/,
  );
});
