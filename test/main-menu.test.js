import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("the main menu excludes the retired World Chronicle", () => {
  assert.doesNotMatch(pageSource, /id="mainMenuChronicleButton"/);
  assert.doesNotMatch(pageSource, /<script defer src="\.\/src\/chronicle\.js"><\/script>/);
});

test("the main menu retains its playable navigation", () => {
  assert.match(pageSource, /id="mainMenuPlayButton"/);
  assert.match(pageSource, /id="mainMenuTutorialButton"/);
  assert.match(pageSource, /id="mainMenuRulebookButton"/);
  assert.match(pageSource, /id="mainMenuSettingsButton"/);
});
