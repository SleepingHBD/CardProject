import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const game = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const rules = readFileSync(new URL("../src/rules.js", import.meta.url), "utf8");

test("live game copy consistently calls the rival the opponent", () => {
  for (const source of [page, game, rules]) {
    assert.doesNotMatch(source, /\bprofessor\b/i);
  }
  assert.match(page, /Opponent's Plan/);
  assert.match(game, /Opponent's Habits/);
  assert.match(page, /id="aiRoundScore">0<\/b> OPPONENT/);
  assert.match(game, /rowMarkup\("ai", "OPPONENT"\)/);
});
