import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const pageSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const tutorialSource = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const tableSource = pageSource.match(/<section class="arena duel-table"[\s\S]*?<\/section>/)?.[0];

test("the dueling table removes portraits but preserves gameplay targets", () => {
  assert.ok(tableSource);
  assert.doesNotMatch(tableSource, /class="avatar|PAWCADET|GRANDMASTER|assets\/characters\//);
  assert.match(tableSource, /class="duelist-nameplate">Opponent<\/div>/);
  assert.match(tableSource, /class="duelist-nameplate">You<\/div>/);

  for (const id of ["aiCollection", "playerCollection", "aiPlayZone", "playerPlayZone", "versusBadge", "clashEffects"]) {
    assert.equal([...tableSource.matchAll(new RegExp(`id="${id}"`, "g"))].length, 1, `${id} must remain available once`);
  }
  assert.doesNotMatch(tableSource, /class="table-lanes"|class="table-lane"/);
});

test("portrait-free trophy rails remain visible and tutorial wording matches", () => {
  assert.match(styleSource, /\.duel-table \.duelist-rail \{/);
  assert.match(styleSource, /\.duel-table \.battlefield \{/);
  assert.match(styleSource, /\.duel-table \.play-zone \{[\s\S]*?display: block;/);
  assert.match(tutorialSource, /elemental crests at the edges of the board track the trophies/);
});

test("the board uses a full-width map rather than inset stone and side columns", () => {
  assert.ok(existsSync(new URL("../assets/backgrounds/duel-map-v1.webp", import.meta.url)));
  assert.match(styleSource, /\.arena\.duel-table \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);[\s\S]*?duel-map-v1\.webp/);
  assert.match(styleSource, /\.duel-table \.battlefield \{[\s\S]*?background: transparent;[\s\S]*?border: 0;/);
});
