import test from "node:test";
import assert from "node:assert/strict";
import "../src/rules.js";

const { chooseAiCard, compareCards, hasWinningSet } = globalThis.ClawRules;

const card = (element, power = 5, color = "red") => ({ element, power, color });

test("element circle resolves correctly", () => {
  assert.equal(compareCards(card("ember"), card("gust")), "player");
  assert.equal(compareCards(card("gust"), card("tide")), "player");
  assert.equal(compareCards(card("tide"), card("ember")), "player");
  assert.equal(compareCards(card("gust"), card("ember")), "ai");
});

test("same element compares power and can draw", () => {
  assert.equal(compareCards(card("ember", 8), card("ember", 4)), "player");
  assert.equal(compareCards(card("ember", 3), card("ember", 7)), "ai");
  assert.equal(compareCards(card("ember", 6), card("ember", 6)), "draw");
});

test("three unique elements form a winning set", () => {
  assert.equal(
    hasWinningSet([card("ember"), card("gust"), card("tide")]),
    true,
  );
});

test("three different colors of one element form a winning set", () => {
  assert.equal(
    hasWinningSet([
      card("tide", 3, "red"),
      card("tide", 5, "blue"),
      card("tide", 8, "gold"),
    ]),
    true,
  );
});

test("duplicate colors do not count toward a mono-element win", () => {
  assert.equal(
    hasWinningSet([
      card("tide", 3, "blue"),
      card("tide", 5, "blue"),
      card("tide", 8, "gold"),
    ]),
    false,
  );
});

test("AI returns a valid card from its hand", () => {
  const hand = [card("ember", 2), card("gust", 9), card("tide", 4)];
  assert.ok(hand.includes(chooseAiCard(hand, [], [], () => 0.5)));
});
